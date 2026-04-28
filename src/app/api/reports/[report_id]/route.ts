import { NextRequest, NextResponse } from "next/server";
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

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[GET /api/reports/[report_id]]", err);
    return NextResponse.json({ success: false, error: err.message || "Internal server error" }, { status: 500 });
  }
}
