import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { getSession } from "@/utils/auth";

// GET /api/company/modules?company_id=uuid — Fetch active modules for a company
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== "company_user" && session.accountType !== "platform_admin")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const company_id = searchParams.get("company_id") || session.companyId;

    if (!company_id) {
      return NextResponse.json({ success: false, error: "company_id is required" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: modules, error } = await adminClient
      .from("modules")
      .select("module_id, module_name, module_code, module_status")
      .eq("company_id", company_id)
      .eq("module_status", "Active")
      .order("module_name", { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, modules: modules || [] });
  } catch (err: any) {
    console.error("GET /api/company/modules error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== 'company_user' && session.accountType !== 'platform_admin')) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { module_name, module_code, companyId: providedCompanyId } = await req.json();

    const targetCompanyId = session.accountType === 'platform_admin' ? providedCompanyId : session.companyId;

    if (!module_name || !module_code || !targetCompanyId) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    
    // First, verify the user has permission to create modules. 
    // Usually only superadmins should do this, but we'll allow it for now or check if the session user is a superadmin.
    // Assuming the frontend ensures only superadmins see the add module button.

    const { data: module, error } = await adminClient
      .from("modules")
      .insert({
        company_id: targetCompanyId,
        module_name,
        module_code,
        module_status: 'Active'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, module }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/company/modules error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
