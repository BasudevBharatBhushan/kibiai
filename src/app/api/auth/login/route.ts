import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { comparePassword, createSession } from "@/utils/auth";

export async function POST(req: Request) {
  try {
    const { email, password, companyId: requestedCompanyId } = await req.json();

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

    // 3. Resolve identity and company context (Company-First)
    let sessionAccountType: "platform_admin" | "company_user" = account.account_type as any;
    let sessionCompanyId: string | undefined = requestedCompanyId;

    // Check if they have a specific user record for this company
    const { data: companyUser } = await supabase
      .from("users")
      .select("company_id")
      .eq("account_id", account.account_id)
      .eq("company_id", requestedCompanyId || "")
      .maybeSingle();

    if (companyUser) {
      // They are a legitimate company user for this workspace
      sessionAccountType = "company_user";
      sessionCompanyId = companyUser.company_id;
    } else if (account.account_type === "platform_admin") {
      // They are a platform admin acting as a superadmin for this company
      sessionAccountType = "platform_admin";
      sessionCompanyId = requestedCompanyId;

      // If no company requested, try to find their default association
      if (!sessionCompanyId) {
        const { data: defaultUser } = await supabase
          .from("users")
          .select("company_id")
          .eq("account_id", account.account_id)
          .maybeSingle();
        sessionCompanyId = defaultUser?.company_id;
      }
    } else if (requestedCompanyId) {
      // Not a platform admin and not a member of the requested company
      return NextResponse.json({ 
        success: false, 
        error: "You do not have access to this workspace." 
      }, { status: 403 });
    }

    // 4. Create session
    await createSession({
      accountId: account.account_id,
      email: account.email,
      accountType: sessionAccountType,
      companyId: sessionCompanyId
    });

    return NextResponse.json({ 
      success: true, 
      user: { 
        email: account.email, 
        accountType: sessionAccountType,
        companyId: sessionCompanyId
      } 
    });

  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
