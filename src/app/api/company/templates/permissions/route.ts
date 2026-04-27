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
    const moduleId = searchParams.get('moduleId');
    const queryCompanyId = searchParams.get('companyId');
    const targetCompanyId = session.accountType === 'platform_admin' ? queryCompanyId : session.companyId;

    if (!userId || !moduleId || !targetCompanyId) {
      return NextResponse.json({ success: false, error: "userId, moduleId and companyId are required" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    
    // Get all report templates for the module
    const { data: templates, error: templatesError } = await adminClient
      .from("report_templates")
      .select("report_template_id, report_template_name")
      .eq("company_id", targetCompanyId)
      .eq("module_id", moduleId);

    if (templatesError) {
      return NextResponse.json({ success: false, error: templatesError.message }, { status: 500 });
    }

    // Get user permissions for these templates
    const templateIds = templates?.map(t => t.report_template_id) || [];
    
    const { data: permissions, error: permissionsError } = await adminClient
      .from("user_template_permissions")
      .select("*")
      .eq("company_id", targetCompanyId)
      .eq("user_id", userId)
      .in("report_template_id", templateIds.length > 0 ? templateIds : ['00000000-0000-0000-0000-000000000000']);

    if (permissionsError) {
      return NextResponse.json({ success: false, error: permissionsError.message }, { status: 500 });
    }

    const permissionMap = new Map(permissions?.map(p => [p.report_template_id, p]));

    const result = templates?.map(t => {
      const perm = permissionMap.get(t.report_template_id) || {};
      return {
        ...t,
        permissions: {
          can_generate_report: perm.can_generate_report || false,
          can_modify_template: perm.can_modify_template || false,
          can_create_template: perm.can_create_template || false,
          can_delete_template: perm.can_delete_template || false,
          can_create_charts: perm.can_create_charts || false,
        }
      };
    }) || [];

    return NextResponse.json({ success: true, templates: result }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/company/templates/permissions error:", err);
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
    const { userId, templateId, permissions, companyId: providedCompanyId } = body;
    const targetCompanyId = session.accountType === 'platform_admin' ? providedCompanyId : session.companyId;

    if (!userId || !templateId || !permissions || !targetCompanyId) {
      return NextResponse.json({ success: false, error: "userId, templateId, permissions and companyId are required" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("user_template_permissions")
      .upsert({
        user_id: userId,
        report_template_id: templateId,
        company_id: targetCompanyId,
        can_generate_report: permissions.can_generate_report || false,
        can_modify_template: permissions.can_modify_template || false,
        can_create_template: permissions.can_create_template || false,
        can_delete_template: permissions.can_delete_template || false,
        can_create_charts: permissions.can_create_charts || false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, report_template_id' });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("PUT /api/company/templates/permissions error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
