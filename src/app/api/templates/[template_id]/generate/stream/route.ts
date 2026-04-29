import { NextRequest } from "next/server";
import { getSession } from "@/utils/auth";
import { createAdminClient } from "@/utils/supabase/server";
import { z } from "zod";

export const maxDuration = 800;

// ── Body schema ────────────────────────────────────────────────────────────────
const streamBodySchema = z.object({
  runtime_filters: z
    .object({
      date_range_fields: z.record(z.string(), z.record(z.string(), z.string())).optional(),
      filters: z.record(z.string(), z.record(z.string(), z.any())).optional(),
    })
    .optional(),
  report_header: z.string().optional(),
});

// ── Helper: encode a single SSE frame ─────────────────────────────────────────
function sseEvent(type: string, payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
}

// ── Helper: non-blocking delay ─────────────────────────────────────────────────
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── POST /api/templates/[template_id]/generate/stream ─────────────────────────
// Strategy: call the existing /api/generate-report engine normally (it already
// returns processing_logs in its response), then replay those log lines back to
// the browser progressively over an SSE stream so the user sees live progress.
// This avoids any cross-route import issues while delivering the same UX.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
  // 1. Auth
  const session = await getSession();
  if (!session || !session.companyId) {
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

  const parsed = streamBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.message }), { status: 400 });
  }

  const { runtime_filters, report_header } = parsed.data;

  // 3. Fetch template from Supabase (company-scoped)
  const supabase = createAdminClient();
  const { data: template, error: fetchError } = await supabase
    .from("report_templates")
    .select("report_template_setup_json, report_template_config_json, report_template_name, company_id")
    .eq("report_template_id", template_id)
    .eq("company_id", session.companyId)
    .single();

  if (fetchError || !template) {
    return new Response(JSON.stringify({ error: "Template not found" }), { status: 404 });
  }

  if (!template.report_template_setup_json) {
    return new Response(
      JSON.stringify({ error: "Template setup is not complete." }),
      { status: 400 }
    );
  }

  if (!template.report_template_config_json) {
    return new Response(
      JSON.stringify({ error: "Template configuration is missing." }),
      { status: 400 }
    );
  }

  const setupJson = template.report_template_setup_json as any;
  const configJson = {
    ...(template.report_template_config_json as any),
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
  if (session.accountId && session.companyId) {
    const { data: userRow } = await supabase
      .from("users")
      .select("user_id")
      .eq("account_id", session.accountId)
      .eq("company_id", session.companyId)
      .maybeSingle();
    generatedByUserId = userRow?.user_id ?? null;
  }

  // 5. Build the SSE ReadableStream
  // The engine runs synchronously inside the stream start callback.
  // We call /api/generate-report internally (same as the regular generate route),
  // which returns { status, report_structure_json, processing_logs }.
  // Then we replay the logs progressively before sending the done event.
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: Uint8Array) => {
        try { controller.enqueue(chunk); } catch { /* client disconnected */ }
      };

      try {
        // Send an initial "starting" log immediately so the UI shows activity
        enqueue(sseEvent("log", { message: "Connecting to report engine…" }));

        // Call the engine — same internal route the regular generate route uses
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

        const { report_structure_json, processing_logs = [] } = engineResult;

        // Replay the processing_logs progressively.
        // Use a short, uniform delay between each log line so the user sees them
        // stream in naturally (max 200ms per line, faster if there are many).
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

        // Auto-save to reports history
        const { data: saved, error: saveError } = await supabase
          .from("reports")
          .insert({
            company_id: session.companyId,
            report_template_id: template_id,
            report_name: reportHeading,
            report_config_json: configJson,
            report_data_json: report_structure_json,
            generated_by_user_id: generatedByUserId,
          })
          .select("report_id")
          .single();

        if (saveError) {
          console.error("[stream] auto-save error:", saveError.message);
        }

        // Send the done event with the full report payload
        enqueue(sseEvent("done", {
          report_structure_json,
          report_name: reportHeading,
          report_id: saved?.report_id ?? null,
        }));

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
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}
