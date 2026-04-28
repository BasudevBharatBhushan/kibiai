import { NextResponse } from "next/server";

import { getSession } from "@/utils/auth";
import { createAdminClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.companyId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("reports")
      .select(
        "report_id, report_name, created_on, report_template_id, report_templates(report_template_name)"
      )
      .eq("company_id", session.companyId)
      .order("created_on", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err: unknown) {
    console.error("[GET /api/reports]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
