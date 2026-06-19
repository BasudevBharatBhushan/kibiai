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
    const search = searchParams.get('search') || '';
    const queryCompanyId = searchParams.get('companyId');
    
    // Use session companyId, but allow override for platform_admins
    const targetCompanyId = session.accountType === 'platform_admin' ? queryCompanyId : session.companyId;

    if (!targetCompanyId) {
      return NextResponse.json({ success: false, error: "Company ID is required" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    
    let query = adminClient
      .from("users")
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
      .eq("company_id", targetCompanyId);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,user_email.ilike.%${search}%`);
    }

    const { data: users, error } = await query.order('created_on', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, users }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/company/staff error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== 'company_user' && session.accountType !== 'platform_admin')) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { full_name, user_email, designation, role_id, password, companyId: providedCompanyId } = await req.json();
    
    const targetCompanyId = session.accountType === 'platform_admin' ? providedCompanyId : session.companyId;

    if (!full_name || !user_email || !role_id || !targetCompanyId) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Optionally check if email already exists in users table for this company
    const { data: existingUser } = await adminClient
      .from("users")
      .select("user_id")
      .eq("company_id", targetCompanyId)
      .eq("user_email", user_email)
      .single();

    if (existingUser) {
      return NextResponse.json({ success: false, error: "User with this email already exists in the company" }, { status: 400 });
    }

    // Handle Auth Account (create if password provided)
    let accountId = null;

    if (password) {
      const { hashPassword } = await import("@/utils/auth");
      const hashedPassword = await hashPassword(password);
      
      const { data: existingAccount } = await adminClient
        .from("auth_accounts")
        .select("account_id")
        .eq("email", user_email)
        .maybeSingle();

      if (existingAccount) {
        accountId = existingAccount.account_id;
        // Optionally update password if requested, but generally we just link
      } else {
        const { data: newAccount, error: authError } = await adminClient
          .from("auth_accounts")
          .insert({
            email: user_email,
            password_hash: hashedPassword,
            account_type: 'company_user'
          })
          .select("account_id")
          .single();

        if (authError || !newAccount) {
          return NextResponse.json({ success: false, error: "Failed to create authentication account" }, { status: 500 });
        }
        accountId = newAccount.account_id;
      }
    } else {
       // Check if account already exists even without password to link it
       const { data: existingAccount } = await adminClient
        .from("auth_accounts")
        .select("account_id")
        .eq("email", user_email)
        .maybeSingle();
       
       if (existingAccount) {
         accountId = existingAccount.account_id;
       }
    }

    const { data: user, error } = await adminClient
      .from("users")
      .insert({
        company_id: targetCompanyId,
        account_id: accountId, // Link if resolved
        full_name,
        user_email,
        designation,
        role_id,
        user_status: 'Active'
      })
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

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/company/staff error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
