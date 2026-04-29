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
  report_header: z.string().optional(),
  report_name: z.string().optional(), // kept for backwards-compat
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

    const { runtime_filters, report_header } = parsed.data;

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

    // 4. Merge runtime filters into config (runtime-only — never persisted)
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

    // 5. Delegate to existing generate-report engine
    const baseUrl = req.nextUrl.origin;
    const engineRes = await fetch(`${baseUrl}/api/generate-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report_setup: setupJson, report_config: configJson }),
    });

    if (!engineRes.ok) {
      const errJson = await engineRes.json().catch(() => null);
      const errText = errJson?.detail || errJson?.error || await engineRes.text();
      console.error("[generate] engine error:", errText);
      return NextResponse.json(
        { success: false, error: errText || "Report engine failed to generate the report." },
        { status: 500 }
      );
    }

    const engineResult = await engineRes.json();

    if (engineResult.status !== "ok" || !engineResult.report_structure_json) {
      console.error("[generate] engine result error:", engineResult.detail || engineResult.error);
      return NextResponse.json(
        { success: false, error: engineResult.detail || engineResult.error || "Engine returned no report data." },
        { status: 500 }
      );
    }

    const reportStructureJson = engineResult.report_structure_json;

    // 6. Extract report heading from TitleHeader for use as report name
    //    (report_template_data_json is intentionally NOT updated — that is admin-only territory)
    const titleHeaderItem = Array.isArray(reportStructureJson)
      ? reportStructureJson.find((i: any) => i && "TitleHeader" in i)
      : null;
    const reportHeading: string =
      titleHeaderItem?.TitleHeader?.MainHeading ||
      template.report_template_name ||
      "Report";

    // 7. Look up the actual users.user_id (FK target) from the users table
    //    session.accountId = auth_accounts.account_id, NOT users.user_id
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

    // 8. Always save to reports history (auto-save on every generation)
    const { data: saved, error: saveError } = await supabase
      .from("reports")
      .insert({
        company_id: session.companyId,
        report_template_id: template_id,
        report_name: reportHeading,
        report_config_json: configJson,
        report_data_json: reportStructureJson,
        generated_by_user_id: generatedByUserId,
      })
      .select("report_id")
      .single();

    if (saveError) {
      // Non-fatal — log but still return the report data so the user sees results
      console.error("[POST /api/templates/[id]/generate] auto-save error:", saveError.message, saveError.details, saveError.hint);
    }

    return NextResponse.json({
      success: true,
      data: {
        report_structure_json: reportStructureJson,
        report_name: reportHeading,
        report_id: saved?.report_id ?? null,
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
