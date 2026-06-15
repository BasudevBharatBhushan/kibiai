import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { getSession } from "@/utils/auth";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== 'company_user' && session.accountType !== 'platform_admin')) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const queryCompanyId = searchParams.get('companyId');
    const targetCompanyId = session.accountType === 'platform_admin' ? queryCompanyId : session.companyId;

    if (!targetCompanyId) {
      return NextResponse.json({ success: false, error: "Company ID is required" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    
    const { data: roles, error } = await adminClient
      .from("roles")
      .select("role_id, role_name, is_super_admin")
      .eq("company_id", targetCompanyId)
      .order('created_on', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, roles }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/company/roles error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
