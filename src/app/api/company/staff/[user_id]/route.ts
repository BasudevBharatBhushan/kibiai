import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { getSession } from "@/utils/auth";

interface RouteParams {
  params: Promise<{
    user_id: string;
  }>;
}

export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { user_id } = await params;
    const { companyId, accountId, accountType } = session;
    const adminClient = createAdminClient();

    // Verify if the current user is a superadmin or platform_admin
    let isSuperAdmin = accountType === "platform_admin";
    if (!isSuperAdmin) {
      const { data: userRole } = await adminClient
        .from("users")
        .select(`
          roles:role_id (
            is_super_admin
          )
        `)
        .eq("account_id", accountId)
        .eq("company_id", companyId)
        .maybeSingle();

      const roles = Array.isArray(userRole?.roles) ? userRole?.roles[0] : userRole?.roles;
      if (roles?.is_super_admin) {
        isSuperAdmin = true;
      }
    }

    if (!isSuperAdmin) {
      return NextResponse.json({ success: false, error: "Forbidden: Superadmin access required" }, { status: 403 });
    }

    // Get target user to check company boundaries
    const { data: targetUser } = await adminClient
      .from("users")
      .select("company_id, user_email")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!targetUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    if (accountType !== "platform_admin" && targetUser.company_id !== companyId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { full_name, user_email, designation, role_id, user_status } = await req.json();

    // Update user record
    const { data: updatedUser, error: updateError } = await adminClient
      .from("users")
      .update({
        full_name,
        user_email,
        designation,
        role_id,
        user_status
      })
      .eq("user_id", user_id)
      .select(`
        user_id,
        user_email,
        full_name,
        designation,
        user_status,
        roles (
          role_id,
          role_name,
          is_super_admin
        )
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    // Optionally update email in auth_accounts if changed
    if (user_email && user_email !== targetUser.user_email) {
      await adminClient
        .from("auth_accounts")
        .update({ email: user_email })
        .eq("email", targetUser.user_email);
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err: any) {
    console.error("PUT /api/company/staff/[user_id] error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { user_id } = await params;
    const { companyId, accountId, accountType } = session;
    const adminClient = createAdminClient();

    // Verify if the current user is a superadmin or platform_admin
    let isSuperAdmin = accountType === "platform_admin";
    if (!isSuperAdmin) {
      const { data: userRole } = await adminClient
        .from("users")
        .select(`
          roles:role_id (
            is_super_admin
          )
        `)
        .eq("account_id", accountId)
        .eq("company_id", companyId)
        .maybeSingle();

      const roles = Array.isArray(userRole?.roles) ? userRole?.roles[0] : userRole?.roles;
      if (roles?.is_super_admin) {
        isSuperAdmin = true;
      }
    }

    if (!isSuperAdmin) {
      return NextResponse.json({ success: false, error: "Forbidden: Superadmin access required" }, { status: 403 });
    }

    // Get target user to check company boundaries
    const { data: targetUser } = await adminClient
      .from("users")
      .select("company_id, user_email, account_id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!targetUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    if (accountType !== "platform_admin" && targetUser.company_id !== companyId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Prevent superadmins from deleting themselves
    const { data: currentUser } = await adminClient
      .from("users")
      .select("user_id")
      .eq("account_id", accountId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (currentUser && currentUser.user_id === user_id) {
      return NextResponse.json({ success: false, error: "You cannot delete your own account" }, { status: 400 });
    }

    // Delete permissions and access first manually to avoid FK errors (if not CASCADE)
    await adminClient.from("user_template_permissions").delete().eq("user_id", user_id);
    await adminClient.from("user_module_access").delete().eq("user_id", user_id);

    // Delete user from users table
    const { error: deleteError } = await adminClient
      .from("users")
      .delete()
      .eq("user_id", user_id);

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    // Also delete from auth_accounts if it is linked and not shared with other records (simplified clean hard delete)
    if (targetUser.account_id) {
      const { data: otherLinks } = await adminClient
        .from("users")
        .select("user_id")
        .eq("account_id", targetUser.account_id);
      
      if (!otherLinks || otherLinks.length === 0) {
        await adminClient
          .from("auth_accounts")
          .delete()
          .eq("account_id", targetUser.account_id);
      }
    }

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (err: any) {
    console.error("DELETE /api/company/staff/[user_id] error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
