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
    const userId = searchParams.get('userId');
    const queryCompanyId = searchParams.get('companyId');
    const targetCompanyId = session.accountType === 'platform_admin' ? queryCompanyId : session.companyId;

    if (!userId || !targetCompanyId) {
      return NextResponse.json({ success: false, error: "userId and companyId are required" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    
    // Get all modules for the company
    const { data: modules, error: modulesError } = await adminClient
      .from("modules")
      .select("module_id, module_name")
      .eq("company_id", targetCompanyId);

    if (modulesError) {
      return NextResponse.json({ success: false, error: modulesError.message }, { status: 500 });
    }

    // Get user access
    const { data: accessData, error: accessError } = await adminClient
      .from("user_module_access")
      .select("module_id")
      .eq("company_id", targetCompanyId)
      .eq("user_id", userId);

    if (accessError) {
      return NextResponse.json({ success: false, error: accessError.message }, { status: 500 });
    }

    const accessedModuleIds = new Set(accessData?.map(a => a.module_id));

    const result = modules?.map(m => ({
      ...m,
      has_access: accessedModuleIds.has(m.module_id)
    })) || [];

    return NextResponse.json({ success: true, modules: result }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/company/modules/access error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== 'company_user' && session.accountType !== 'platform_admin')) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { userId, moduleId, hasAccess, companyId: providedCompanyId } = body;
    const targetCompanyId = session.accountType === 'platform_admin' ? providedCompanyId : session.companyId;

    if (!userId || !moduleId || hasAccess === undefined || !targetCompanyId) {
      return NextResponse.json({ success: false, error: "userId, moduleId, hasAccess, and companyId are required" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    if (hasAccess) {
      const { error } = await adminClient
        .from("user_module_access")
        .upsert({
          user_id: userId,
          module_id: moduleId,
          company_id: targetCompanyId
        }, { onConflict: 'user_id, module_id' });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await adminClient
        .from("user_module_access")
        .delete()
        .eq("user_id", userId)
        .eq("module_id", moduleId)
        .eq("company_id", targetCompanyId);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("PUT /api/company/modules/access error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
