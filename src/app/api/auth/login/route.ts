import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { comparePassword, createSession } from "@/utils/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Find account in auth_accounts
    const { data: account, error: accountError } = await supabase
      .from("auth_accounts")
      .select("*")
      .eq("email", email)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    // 2. Verify password
    const isPasswordValid = await comparePassword(password, account.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    // 3. Always resolve company affiliation from the users table.
    //    This handles accounts that exist as platform_admin in auth_accounts
    //    but also have a company association in the users table (e.g., company portal logins).
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("account_id", account.account_id)
      .maybeSingle();

    const companyId: string | undefined = userData?.company_id ?? undefined;


    // 4. Create session
    await createSession({
      accountId: account.account_id,
      email: account.email,
      accountType: account.account_type as any,
      companyId
    });

    return NextResponse.json({ 
      success: true, 
      user: { 
        email: account.email, 
        accountType: account.account_type 
      } 
    });

  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
