import { NextResponse } from "next/server";
import { SetupService } from "@/services/setup.service";
import { getSession } from "@/utils/auth";
import { createAdminClient } from "@/utils/supabase/server";

// GET /api/company/setups?company_id=...&module_id=...
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== "company_user" && session.accountType !== "platform_admin")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const company_id = searchParams.get("company_id") || session.companyId;
    const module_id = searchParams.get("module_id") || undefined;

    if (!company_id) {
      return NextResponse.json({ success: false, error: "company_id is required" }, { status: 400 });
    }

    // Security check: company_user can only see their own company's setups
    if (session.accountType === "company_user" && company_id !== session.companyId) {
       return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const setups = await SetupService.getSavedSetups(company_id, module_id);
    return NextResponse.json({ success: true, setups });
  } catch (err: any) {
    console.error("GET /api/company/setups error:", err);
    return NextResponse.json({ success: false, error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/company/setups
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== "company_user" && session.accountType !== "platform_admin")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const { company_id: providedCompanyId, module_id, setup_name, setup_description, setup_json } = body;
    const company_id = providedCompanyId || session.companyId;

    if (!module_id || !setup_name || !setup_json || !company_id) {
      return NextResponse.json(
        { success: false, error: "module_id, setup_name, and setup_json are required" },
        { status: 400 }
      );
    }

    // Security check
    if (session.accountType === "company_user" && company_id !== session.companyId) {
       return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const adminClient = createAdminClient();
    const { data: userRecord } = await adminClient
      .from("users")
      .select("user_id")
      .eq("account_id", session.accountId)
      .eq("company_id", company_id)
      .maybeSingle();

    const setup = await SetupService.createSetup({
      company_id,
      module_id,
      setup_name,
      setup_description,
      setup_json,
      created_by_user_id: userRecord?.user_id || null
    });

    return NextResponse.json({ success: true, setup }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/company/setups error:", err);
    return NextResponse.json({ success: false, error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
