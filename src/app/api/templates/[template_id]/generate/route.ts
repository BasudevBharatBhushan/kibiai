import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/utils/auth";
import { createAdminClient } from "@/utils/supabase/server";
import { z } from "zod";

// ── Zod Schema ────────────────────────────────────────────────────────────────
const generateBodySchema = z.object({
  runtime_filters: z
    .object({
      date_range_fields: z.record(z.string(), z.record(z.string(), z.string())).optional(),
      filters: z.record(z.string(), z.record(z.string(), z.any())).optional(),
    })
    .optional(),
  report_name: z.string().optional(),
  save_to_history: z.boolean().optional(),
});

// ── POST /api/templates/[template_id]/generate ───────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
  try {
    // 1. Auth
    const session = await getSession();
    if (!session || !session.companyId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { template_id } = await params;
    if (!template_id) {
      return NextResponse.json({ success: false, error: "template_id is required" }, { status: 400 });
    }

    // 2. Validate body
    const body = await req.json();
    const parsed = generateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });
    }

    const { runtime_filters, report_name, save_to_history } = parsed.data;

    // 3. Fetch template config from Supabase (company-scoped)
    const supabase = createAdminClient();
    const { data: template, error: fetchError } = await supabase
      .from("report_templates")
      .select("report_template_setup_json, report_template_config_json, report_template_name, company_id")
      .eq("report_template_id", template_id)
      .eq("company_id", session.companyId)
      .single();

    if (fetchError || !template) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    if (!template.report_template_setup_json) {
      return NextResponse.json(
        { success: false, error: "Template setup is not complete. Please run the Setup Wizard first." },
        { status: 400 }
      );
    }

    if (!template.report_template_config_json) {
      return NextResponse.json(
        { success: false, error: "Template configuration is missing. Please configure the report first." },
        { status: 400 }
      );
    }

    const setupJson = template.report_template_setup_json as any;

    // 4. Merge runtime filters into config (do NOT persist — runtime-only)
    const configJson = {
      ...(template.report_template_config_json as any),
      ...(runtime_filters?.date_range_fields !== undefined
        ? { date_range_fields: runtime_filters.date_range_fields }
        : {}),
      ...(runtime_filters?.filters !== undefined
        ? { filters: runtime_filters.filters }
        : {}),
    };

    // 5. Delegate to existing generate-report engine (body-driven — no FM record ID needed)
    //    Using internal fetch to avoid duplicating engine logic.
    const baseUrl = req.nextUrl.origin;
    const engineRes = await fetch(`${baseUrl}/api/generate-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report_setup: setupJson, report_config: configJson }),
    });

    if (!engineRes.ok) {
      const errText = await engineRes.text();
      console.error("[generate] engine error:", errText);
      return NextResponse.json(
        { success: false, error: "Report engine failed to generate the report." },
        { status: 500 }
      );
    }

    const engineResult = await engineRes.json();

    if (engineResult.status !== "ok" || !engineResult.report_structure_json) {
      return NextResponse.json(
        { success: false, error: engineResult.error || "Engine returned no report data." },
        { status: 500 }
      );
    }

    const reportStructureJson = engineResult.report_structure_json;

    // 6. Optionally save to reports history
    let reportId: string | null = null;
    if (save_to_history) {
      const finalReportName =
        report_name ||
        `${template.report_template_name} — ${new Date().toLocaleDateString("en-US")}`;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        session.accountId ?? ""
      );

      const { data: saved, error: saveError } = await supabase
        .from("reports")
        .insert({
          company_id: session.companyId,
          report_template_id: template_id,
          report_name: finalReportName,
          report_config_json: configJson,
          report_data_json: reportStructureJson,
          generated_by_user_id: isUuid ? session.accountId : null,
        })
        .select("report_id")
        .single();

      if (saveError) {
        // Non-fatal: log but still return the report
        console.error("[POST /api/templates/[id]/generate] save error:", saveError.message, saveError.details);
      } else {
        reportId = saved?.report_id ?? null;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        report_structure_json: reportStructureJson,
        report_id: reportId,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/templates/[id]/generate]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Report generation failed" },
      { status: 500 }
    );
  }
}
