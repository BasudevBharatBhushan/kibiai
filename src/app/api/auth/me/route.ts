import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { getSession } from "@/utils/auth";

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ success: false, error: "Not logged in" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  
  let userData: Record<string, any> = {
    name: session.accountType === 'platform_admin' ? "Platform Admin" : "User",
    role: session.accountType === 'platform_admin' ? "Superadmin" : "Staff",
    // Extended fields (T-016)
    user_id: null,
    role_id: null,
    is_super_admin: session.accountType === 'platform_admin',
    company_id: session.companyId ?? null,
  };

  // Try to find a user record: first by account_id, then by email
  // (invited staff may have account_id = null until they first log in)
  let user: any = null;

  if (session.accountId) {
    const { data } = await adminClient
      .from("users")
      .select(`
        user_id,
        full_name,
        role_id,
        roles:role_id (
          role_name,
          is_super_admin
        )
      `)
      .eq("account_id", session.accountId)
      .maybeSingle();
    if (data) user = data;
  }

  // Email fallback
  if (!user && session.email) {
    const { data } = await adminClient
      .from("users")
      .select(`
        user_id,
        full_name,
        role_id,
        roles:role_id (
          role_name,
          is_super_admin
        )
      `)
      .eq("user_email", session.email)
      .maybeSingle();
    if (data) user = data;
  }

  if (user) {
    const roleData = Array.isArray(user.roles) ? user.roles[0] : user.roles;
    userData = {
      name: user.full_name || userData.name,
      role: (roleData as any)?.role_name || userData.role,
      // Extended fields (T-016)
      user_id: user.user_id,
      role_id: user.role_id,
      is_super_admin: (roleData as any)?.is_super_admin === true,
      company_id: session.companyId ?? null,
    };
  } else if (session.accountType === 'platform_admin') {
    // Platform admins: derive name from email
    const nameFromEmail = session.email.split('@')[0];
    userData.name = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
  }

  return NextResponse.json({ 
    success: true, 
    user: {
      email: session.email,
      accountType: session.accountType,
      ...userData
    } 
  });
}
