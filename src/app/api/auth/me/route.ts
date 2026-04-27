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
  
  let userData = {
    name: session.accountType === 'platform_admin' ? "Platform Admin" : "User",
    role: session.accountType === 'platform_admin' ? "Superadmin" : "Staff"
  };

  // Try to find a user record for this account to get a real name
  const { data: user, error: userError } = await adminClient
    .from("users")
    .select(`
      full_name,
      roles:role_id (
        role_name
      )
    `)
    .eq("account_id", session.accountId)
    .maybeSingle();
  
  if (userError) {
    console.error("Error fetching user details in /api/auth/me:", userError);
  }

  if (user) {
    const roleData = Array.isArray(user.roles) ? user.roles[0] : user.roles;
    userData = {
      name: user.full_name || userData.name,
      role: (roleData as any)?.role_name || userData.role
    };
  } else if (session.accountType === 'platform_admin') {
    // If no user record found for platform admin, we might want to check platform_admins table
    // but it has no name column yet, so we stick with the default or email part
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
