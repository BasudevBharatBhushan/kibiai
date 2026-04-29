import { NextResponse } from "next/server";
import { getSession } from "@/utils/auth";
import { createAdminClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.companyId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("template_id");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const supabase = createAdminClient();
    let query = supabase
      .from("reports")
      .select("report_id, report_name, created_on, report_template_id, report_data_json")
      .eq("company_id", session.companyId)
      .order("created_on", { ascending: false })
      .limit(limit);

    if (templateId) {
      query = query.eq("report_template_id", templateId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err: unknown) {
    console.error("[GET /api/reports]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

