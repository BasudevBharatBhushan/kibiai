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

    // 3. Resolve company context
    let sessionCompanyId: string | undefined = undefined;

    if (requestedCompanyId) {
      // If logging into a specific company workspace
      const { data: userData } = await supabase
        .from("users")
        .select("company_id")
        .eq("account_id", account.account_id)
        .eq("company_id", requestedCompanyId)
        .maybeSingle();

      if (userData) {
        sessionCompanyId = userData.company_id;
      } else if (account.account_type === 'platform_admin') {
         // Auto-add platform admin to this company
         const { data: roles } = await supabase
           .from("roles")
           .select("role_id")
           .eq("company_id", requestedCompanyId)
           .eq("role_name", "Superadmin")
           .maybeSingle();
         
         if (roles) {
           await supabase.from("users").insert({
             account_id: account.account_id,
             company_id: requestedCompanyId,
             role_id: roles.role_id,
             user_email: email,
             full_name: "Platform Admin",
             user_status: "Active"
           });
           sessionCompanyId = requestedCompanyId;
         } else {
           return NextResponse.json({ success: false, error: "Superadmin role missing in company" }, { status: 500 });
         }
      } else {
        return NextResponse.json({ success: false, error: "Unauthorized for this company" }, { status: 403 });
      }
    } else {
      // Admin portal login or root login
      if (account.account_type !== 'platform_admin') {
        const { data: userData } = await supabase
          .from("users")
          .select("company_id")
          .eq("account_id", account.account_id)
          .limit(1)
          .maybeSingle();
        sessionCompanyId = userData?.company_id ?? undefined;
      }
    }

    // 4. Create session
    const jwt = await createSession({
      accountId: account.account_id,
      email: account.email,
      accountType: account.account_type as any,
      companyId: sessionCompanyId
    });

    const isProd = process.env.NODE_ENV === 'production';
    const host = req.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

    // Create the response
    const response = NextResponse.json({ 
      success: true, 
      user: { 
        email: account.email, 
        accountType: account.account_type 
      } 
    });

    // Manually set the cookie header for maximum reliability in API routes
    const cookieOptions = [
      `kibiai_session=${jwt}`,
      `Max-Age=${60 * 60 * 24 * 30}`,
      `Path=/`,
      `HttpOnly`,
      `SameSite=Lax`,
      isProd && !isLocalhost ? `Secure` : '',
    ].filter(Boolean).join('; ');

    response.headers.set('Set-Cookie', cookieOptions);

    return response;

  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
