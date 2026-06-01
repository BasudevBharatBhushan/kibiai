import { NextRequest } from "next/server";
import { getSession } from "@/utils/auth";
import { createAdminClient } from "@/utils/supabase/server";
import { sanitizeJsonForPostgres } from "@/lib/utils/sanitizeJsonForPostgres";
import { z } from "zod";

export const maxDuration = 300; // Vercel Pro max; set to 800 only on Enterprise

// ── Body schema ────────────────────────────────────────────────────────────────
const streamBodySchema = z.object({
  runtime_filters: z
    .object({
      date_range_fields: z.record(z.string(), z.record(z.string(), z.string())).optional(),
      filters: z.record(z.string(), z.record(z.string(), z.any())).optional(),
    })
    .optional(),
  report_header: z.string().optional(),
  persist_to_template: z.boolean().optional(), // true = admin configurator update
  config_json: z.record(z.string(), z.any()).optional(),
});

// ── Helper: encode a single SSE frame ─────────────────────────────────────────
function sseEvent(type: string, payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
}

// ── Helper: non-blocking delay ─────────────────────────────────────────────────
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── POST /api/templates/[template_id]/generate/stream ─────────────────────────
// persist_to_template: true  → admin configurator "Update" flow
//   - saves preview to report_templates
//   - creates a report_template_versions record (NOT a reports record)
// persist_to_template: false → user "Generate" flow
//   - creates a reports record (history)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
  // 1. Auth
  const session = await getSession();
  if (!session || (session.accountType !== "platform_admin" && !session.companyId)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { template_id } = await params;
  if (!template_id) {
    return new Response(JSON.stringify({ error: "template_id is required" }), { status: 400 });
  }

  // 2. Parse + validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const parsedBody = streamBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return new Response(JSON.stringify({ error: parsedBody.error.message }), { status: 400 });
  }

  const { runtime_filters, report_header, persist_to_template, config_json } = parsedBody.data;

  // 3. Fetch template from Supabase (company-scoped for regular users only)
  const supabase = createAdminClient();
  let templateQuery = supabase
    .from("report_templates")
    .select("report_template_setup_json, setup_id, report_template_config_json, report_template_name, company_id")
    .eq("report_template_id", template_id);

  if (session.accountType !== "platform_admin") {
    templateQuery = templateQuery.eq("company_id", session.companyId);
  }

  const { data: template, error: fetchError } = await templateQuery.single();

  if (fetchError || !template) {
    return new Response(JSON.stringify({ error: "Template not found" }), { status: 404 });
  }

  // Resolve the authoritative company_id from the template (critical for platform admins)
  const targetCompanyId = template.company_id;

  // ── Setup JSON with reusable setup_id fallback ─────────────────────────────
  let setupJson = template.report_template_setup_json as any;
  const isLocalEmpty =
    !setupJson ||
    (typeof setupJson === "object" && Object.keys(setupJson).length === 0) ||
    (setupJson.tables && Object.keys(setupJson.tables).length === 0);

  if (isLocalEmpty && template.setup_id) {
    const { data: reusableSetup, error: setupError } = await supabase
      .from("report_template_setups")
      .select("setup_json")
      .eq("setup_id", template.setup_id)
      .maybeSingle();

    if (!setupError && reusableSetup) {
      setupJson = reusableSetup.setup_json;
    }
  }

  if (!setupJson || (typeof setupJson === "object" && Object.keys(setupJson).length === 0)) {
    return new Response(
      JSON.stringify({ error: "Template setup is not complete. Please run the Setup Wizard first." }),
      { status: 400 }
    );
  }

  const templateConfig = config_json ?? template.report_template_config_json;

  if (!templateConfig) {
    return new Response(
      JSON.stringify({ error: "Template configuration is missing." }),
      { status: 400 }
    );
  }

  const configJson = {
    ...(templateConfig as any),
    ...(report_header ? { report_header } : {}),
    ...(runtime_filters?.date_range_fields !== undefined
      ? { date_range_fields: runtime_filters.date_range_fields }
      : {}),
    ...(runtime_filters?.filters !== undefined
      ? { filters: runtime_filters.filters }
      : {}),
  };

  // 4. Look up the actual user_id FK
  let generatedByUserId: string | null = null;
  if (session.accountId && targetCompanyId) {
    const { data: userRow } = await supabase
      .from("users")
      .select("user_id")
      .eq("account_id", session.accountId)
      .eq("company_id", targetCompanyId)
      .maybeSingle();
    generatedByUserId = userRow?.user_id ?? null;
  }

  // 5. Build the SSE ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: Uint8Array) => {
        try { controller.enqueue(chunk); } catch { /* client disconnected */ }
      };

      try {
        enqueue(sseEvent("log", { message: "Connecting to report engine…" }));

        const baseUrl = req.nextUrl.origin;
        const engineRes = await fetch(`${baseUrl}/api/generate-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ report_setup: setupJson, report_config: configJson }),
        });

        if (!engineRes.ok) {
          const errJson = await engineRes.json().catch(() => null);
          const errMsg = errJson?.detail || errJson?.error || `Engine error ${engineRes.status}`;
          throw new Error(errMsg);
        }

        const engineResult = await engineRes.json();

        if (engineResult.status !== "ok" || !engineResult.report_structure_json) {
          throw new Error(engineResult.detail || engineResult.error || "Engine returned no report data.");
        }

        const { processing_logs = [] } = engineResult;
        const report_structure_json = sanitizeJsonForPostgres(engineResult.report_structure_json);
        const stitch_result = engineResult.stitch_result ?? null; // cached for client-side soft reloads
        const persistedConfigJson = sanitizeJsonForPostgres(configJson);

        // Replay the processing_logs progressively
        const logDelay = Math.max(60, Math.min(200, 1500 / Math.max(processing_logs.length, 1)));
        for (const msg of processing_logs as string[]) {
          enqueue(sseEvent("log", { message: msg }));
          await delay(logDelay);
        }

        // Extract report heading
        const titleHeaderItem = Array.isArray(report_structure_json)
          ? report_structure_json.find((i: any) => i && "TitleHeader" in i)
          : null;
        const reportHeading: string =
          titleHeaderItem?.TitleHeader?.MainHeading ||
          template.report_template_name ||
          "Report";

        let savedRecordId: string | null = null;

        if (persist_to_template) {
          // ── ADMIN CONFIGURATOR: persist preview + create a template version ──
          // 1. Update the template preview data
          const { data: persistedTemplate, error: persistError } = await supabase
            .from("report_templates")
            .update({
              report_template_config_json: persistedConfigJson,
              report_template_data_json: report_structure_json,
              updated_on: new Date().toISOString(),
            })
            .eq("report_template_id", template_id)
            .eq("company_id", targetCompanyId)
            .select("report_template_id")
            .single();

          if (persistError || !persistedTemplate) {
            console.error("[stream] persist error:", persistError);
            throw new Error(persistError?.message || "Failed to save generated report preview to template.");
          }

          // 2. Get the current max version number for this template
          const { data: maxVersionRow } = await supabase
            .from("report_template_versions")
            .select("version_number")
            .eq("report_template_id", template_id)
            .order("version_number", { ascending: false })
            .limit(1)
            .maybeSingle();

          const nextVersion = (maxVersionRow?.version_number ?? 0) + 1;

          // 3. Insert a new version record
          const { data: versionRow, error: versionError } = await supabase
            .from("report_template_versions")
            .insert({
              report_template_id: template_id,
              company_id: targetCompanyId,
              version_number: nextVersion,
              config_json: persistedConfigJson,
              preview_data_json: report_structure_json,
              changed_by_user_id: generatedByUserId,
            })
            .select("version_id")
            .single();

          if (versionError) {
            console.error("[stream] version insert error:", versionError.message);
          } else {
            savedRecordId = versionRow?.version_id ?? null;
          }

          enqueue(sseEvent("done", {
            report_structure_json,
            stitch_result,
            report_name: reportHeading,
            version_id: savedRecordId,
            report_id: null,
          }));
        } else {
          // ── USER GENERATE: create a reports record ──────────────────────────
          const { data: persistedTemplate, error: persistTemplateError } = await supabase
            .from("report_templates")
            .update({
              report_template_data_json: {
                report_structure_json,
                stitch_result,
              },
              updated_on: new Date().toISOString(),
            })
            .eq("report_template_id", template_id)
            .eq("company_id", targetCompanyId)
            .select("report_template_id")
            .single();

          if (persistTemplateError || !persistedTemplate) {
            console.error("[stream] template data persist error:", persistTemplateError);
            throw new Error(persistTemplateError?.message || "Failed to save generated report data to template.");
          }

          const { data: saved, error: saveError } = await supabase
            .from("reports")
            .insert({
              company_id: targetCompanyId,
              report_template_id: template_id,
              report_name: reportHeading,
              report_config_json: persistedConfigJson,
              report_data_json: report_structure_json,
              generated_by_user_id: generatedByUserId,
            })
            .select("report_id")
            .single();

          if (saveError) {
            console.error("[stream] auto-save error:", saveError.message);
          } else {
            savedRecordId = saved?.report_id ?? null;
          }

          enqueue(sseEvent("done", {
            report_structure_json,
            stitch_result,
            report_name: reportHeading,
            report_id: savedRecordId,
            version_id: null,
          }));
        }

      } catch (err: any) {
        enqueue(sseEvent("error", { message: err.message || "Report generation failed" }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
