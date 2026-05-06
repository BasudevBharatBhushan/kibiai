import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { hashPassword } from "@/utils/auth";

export async function POST(req: Request) {
  try {
    const { fullName, email, password, companyId } = await req.json();

    if (!fullName || !email || !password || !companyId) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Check if user already exists in this company
    const { data: existingUser } = await supabase
      .from("users")
      .select("user_id")
      .eq("company_id", companyId)
      .eq("user_email", email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ success: false, error: "You are already a member of this workspace. Please log in." }, { status: 400 });
    }

    // 2. Handle auth_accounts
    const { data: existingAccount } = await supabase
      .from("auth_accounts")
      .select("account_id")
      .eq("email", email)
      .maybeSingle();

    let accountId = null;

    if (existingAccount) {
      accountId = existingAccount.account_id;
      // Note: We don't overwrite their existing password to avoid breaking their access to other companies
    } else {
      const hashedPassword = await hashPassword(password);
      const { data: newAccount, error: accountError } = await supabase
        .from("auth_accounts")
        .insert({
          email: email,
          password_hash: hashedPassword,
          account_type: 'company_user'
        })
        .select("account_id")
        .single();

      if (accountError || !newAccount) {
        return NextResponse.json({ success: false, error: "Failed to create account" }, { status: 500 });
      }
      accountId = newAccount.account_id;
    }

    // 3. Get Staff role for this company
    const { data: staffRole } = await supabase
      .from("roles")
      .select("role_id")
      .eq("company_id", companyId)
      .eq("role_name", "Staff")
      .maybeSingle();

    if (!staffRole) {
      return NextResponse.json({ success: false, error: "Configuration error: Staff role not found in this company." }, { status: 500 });
    }

    // 4. Create User record
    const { error: userError } = await supabase
      .from("users")
      .insert({
        account_id: accountId,
        company_id: companyId,
        role_id: staffRole.role_id,
        user_email: email,
        full_name: fullName,
        user_status: "Active"
      });

    if (userError) {
       return NextResponse.json({ success: false, error: "Failed to join company: " + userError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Signup error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
