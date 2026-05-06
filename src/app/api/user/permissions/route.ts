import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { getSession } from "@/utils/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/permissions
 *
 * Returns the complete permission profile for the currently
 * authenticated company user in a single call:
 * - role (with is_super_admin flag)
 * - module_access[]
 * - template_permissions[]
 *
 * Works for both 'company_user' and 'platform_admin' account types,
 * as long as a companyId is present in the session.
 *
 * User lookup: first by account_id (if set), then by email — because
 * staff accounts created via invitation may have account_id = null.
 *
 * Superadmins (roles.is_super_admin = true) receive full-access
 * permissions on every template in the company.
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();

    // Allow both company_user AND platform_admin — platform admins can also
    // have a company workspace association (e.g. the company owner who is
    // also the platform admin).
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { accountId, email, accountType } = session;
    let { companyId } = session;

    // If companyId is missing from session (common for platform admins),
    // allow it to be provided via query parameter.
    if (!companyId) {
      const { searchParams } = new URL(req.url);
      companyId = searchParams.get("companyId") || undefined;
    }

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "Company context missing from session" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // ── 1. Fetch user record + role ──────────────────────────────────────────
    // Try by account_id first (populated for users who logged in and linked
    // their auth account). Fall back to email lookup for invited staff whose
    // account_id may still be null.

    let user: any = null;

    if (accountId) {
      const { data } = await adminClient
        .from("users")
        .select(
          `
          user_id,
          account_id,
          user_email,
          company_id,
          role_id,
          roles:role_id (
            role_id,
            role_name,
            is_super_admin
          )
        `
        )
        .eq("account_id", accountId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (data) user = data;
    }

    // Fallback: look up by email
    if (!user && email) {
      const { data } = await adminClient
        .from("users")
        .select(
          `
          user_id,
          account_id,
          user_email,
          company_id,
          role_id,
          roles:role_id (
            role_id,
            role_name,
            is_super_admin
          )
        `
        )
        .eq("user_email", email)
        .eq("company_id", companyId)
        .maybeSingle();

      if (data) user = data;
    }

    if (!user) {
      // Special case: Platform admins are treated as superadmins for ANY company,
      // even if they don't have a record in the users table for that company.
      if (accountType === "platform_admin") {
        user = {
          user_id: `admin-${accountId}`,
          account_id: accountId,
          user_email: email,
          company_id: companyId,
          roles: {
            role_id: "platform-admin",
            role_name: "Platform Admin",
            is_super_admin: true,
          },
        };
      } else {
        return NextResponse.json(
          { success: false, error: "User not found in company workspace" },
          { status: 404 }
        );
      }
    }

    const roleData = Array.isArray(user.roles) ? user.roles[0] : user.roles;
    const isSuperAdmin = (roleData as any)?.is_super_admin === true;
    const userId = user.user_id;

    // ── 2. Fetch all report templates for the company ────────────────────────
    const { data: allTemplates, error: templatesError } = await adminClient
      .from("report_templates")
      .select("report_template_id, report_template_name, module_id")
      .eq("company_id", companyId);

    if (templatesError) {
      return NextResponse.json(
        { success: false, error: templatesError.message },
        { status: 500 }
      );
    }

    // ── 3. Superadmin shortcut: full access on everything ───────────────────
    if (isSuperAdmin) {
      const { data: allModules, error: modulesError } = await adminClient
        .from("modules")
        .select("module_id, module_name, module_code")
        .eq("company_id", companyId);

      if (modulesError) {
        return NextResponse.json(
          { success: false, error: modulesError.message },
          { status: 500 }
        );
      }

      const templatePermissions = (allTemplates || []).map((t) => ({
        report_template_id: t.report_template_id,
        module_id: t.module_id,
        can_generate_report: true,
        can_modify_template: true,
        can_create_template: true,
        can_delete_template: true,
        can_generate_charts: true,
        can_analyze_charts: true,
      }));

      return NextResponse.json({
        success: true,
        user: {
          user_id: userId,
          account_id: accountId,
          role: {
            role_id: (roleData as any)?.role_id ?? null,
            role_name: (roleData as any)?.role_name ?? "Superadmin",
            is_super_admin: true,
          },
          module_access: (allModules || []).map((m) => ({
            module_id: m.module_id,
            module_name: m.module_name,
            module_code: m.module_code,
          })),
          template_permissions: templatePermissions,
        },
      });
    }

    // ── 4. Regular user: fetch actual permissions ───────────────────────────
    const { data: moduleAccess, error: moduleError } = await adminClient
      .from("user_module_access")
      .select(
        `
        module_id,
        modules:module_id (
          module_name,
          module_code
        )
      `
      )
      .eq("user_id", userId)
      .eq("company_id", companyId);

    if (moduleError) {
      return NextResponse.json(
        { success: false, error: moduleError.message },
        { status: 500 }
      );
    }

    const templateIds = (allTemplates || []).map((t) => t.report_template_id);

    const { data: templatePerms, error: permsError } = await adminClient
      .from("user_template_permissions")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .in(
        "report_template_id",
        templateIds.length > 0
          ? templateIds
          : ["00000000-0000-0000-0000-000000000000"]
      );

    if (permsError) {
      return NextResponse.json(
        { success: false, error: permsError.message },
        { status: 500 }
      );
    }

    const permMap = new Map(
      (templatePerms || []).map((p) => [p.report_template_id, p])
    );

    const templatePermissions = (allTemplates || []).map((t) => {
      const perm = permMap.get(t.report_template_id) || {};
      return {
        report_template_id: t.report_template_id,
        module_id: t.module_id,
        can_generate_report: (perm as any).can_generate_report || false,
        can_modify_template: (perm as any).can_modify_template || false,
        can_create_template: (perm as any).can_create_template || false,
        can_delete_template: (perm as any).can_delete_template || false,
        can_generate_charts: (perm as any).can_generate_charts || false,
        can_analyze_charts: (perm as any).can_analyze_charts || false,
      };
    });

    return NextResponse.json({
      success: true,
      user: {
        user_id: userId,
        account_id: accountId,
        role: {
          role_id: (roleData as any)?.role_id ?? null,
          role_name: (roleData as any)?.role_name ?? "Staff",
          is_super_admin: false,
        },
        module_access: (moduleAccess || []).map((m) => ({
          module_id: m.module_id,
          module_name: (m.modules as any)?.module_name ?? "",
          module_code: (m.modules as any)?.module_code ?? "",
        })),
        template_permissions: templatePermissions,
      },
    });
  } catch (err: any) {
    console.error("GET /api/user/permissions error:", err);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
