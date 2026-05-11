import { NextRequest, NextResponse } from "next/server";

import {
  extractBodyRows,
  normalizeChartTemplates,
} from "@/lib/charts/supabaseAdapters";
import { getSession } from "@/utils/auth";
import { createAdminClient } from "@/utils/supabase/server";

// ── GET /api/reports/[report_id] ─────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ report_id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !session.companyId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { report_id } = await params;
    if (!report_id) {
      return NextResponse.json({ success: false, error: "report_id is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("reports")
      .select(
        "report_id, report_name, report_config_json, report_data_json, report_insight, created_on, report_template_id"
      )
      .eq("report_id", report_id)
      .eq("company_id", session.companyId)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
    }

    // Fetch the parent template's config + setup so the dashboard can derive
    // FieldSchemas needed by the insight formula executor.
    const { data: template } = await supabase
      .from("report_templates")
      .select("report_template_config_json, report_template_setup_json")
      .eq("report_template_id", data.report_template_id)
      .eq("company_id", session.companyId)
      .single();

    const { data: chartTemplates, error: chartError } = await supabase
      .from("chart_templates")
      .select(
        "chart_template_id, chart_template_name, chart_template_type, chart_template_setup_json, chart_template_dataset_json, chart_template_canvas_state"
      )
      .eq("report_template_id", data.report_template_id)
      .eq("company_id", session.companyId)
      .order("created_on", { ascending: true });

    if (chartError) {
      return NextResponse.json(
        { success: false, error: chartError.message },
        { status: 500 }
      );
    }

    const normalized = normalizeChartTemplates(chartTemplates);
    const rows = extractBodyRows(data.report_data_json);

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        report_template_config_json: template?.report_template_config_json ?? null,
        report_template_setup_json: template?.report_template_setup_json ?? null,
        rows,
        ...normalized,
      },
    });
  } catch (err: unknown) {
    console.error("[GET /api/reports/[report_id]]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
