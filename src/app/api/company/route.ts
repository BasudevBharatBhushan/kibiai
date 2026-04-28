import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { getSession, hashPassword } from "@/utils/auth";

// ---------------------------------------------------------------------------
// Slug utilities for subdomain routing
// ---------------------------------------------------------------------------

/** Reserved subdomains that cannot be used as company slugs. */
const RESERVED_SLUGS = new Set([
  "admin", "api", "www", "kibiai", "app",
  "mail", "ftp", "support", "help", "static", "assets",
]);

/**
 * Converts a company name to a URL-safe kebab-case slug.
 * e.g. "Acme Corp. Ltd." → "acme-corp-ltd"
 */
function toSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")  // remove special chars
    .replace(/\s+/g, "-")           // spaces → hyphens
    .replace(/-+/g, "-")            // collapse multiple hyphens
    .replace(/^-|-$/g, "");         // trim leading/trailing hyphens
}

export async function POST(req: Request) {
  try {
    // 1. Verify Authentication (Custom JWT)
    const session = await getSession();

    if (!session || session.accountType !== 'platform_admin') {
      return NextResponse.json({ success: false, error: "Unauthorized. Platform Admin only." }, { status: 401 });
    }

    // 2. Parse JSON
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      companyAuthId,
      companyPassword,
      companyName,
      planCode
    } = body;
    
    if (!companyAuthId || !companyPassword || !companyName) {
      return NextResponse.json({
        success: false,
        error: "Company Name, Email, and Password are required",
      }, { status: 400 });
    }

    // 2b. Derive and validate slug
    const companySlug = toSlug(companyName);
    if (!companySlug) {
      return NextResponse.json({ success: false, error: "Company name produces an invalid URL slug" }, { status: 400 });
    }
    if (RESERVED_SLUGS.has(companySlug)) {
      return NextResponse.json({ success: false, error: `Company name "${companyName}" is reserved and cannot be used` }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 3. Check if company name already exists
    const { data: existingCompany } = await adminClient
      .from("companies")
      .select("company_id")
      .eq("company_name", companyName)
      .maybeSingle();

    if (existingCompany) {
      return NextResponse.json({ success: false, error: "A company with this name already exists" }, { status: 400 });
    }

    // 3b. Check if slug is already taken (e.g. "Acme Corp" and "Acme Corp." produce same slug)
    const { data: existingSlug } = await adminClient
      .from("allowed_subdomains")
      .select("subdomain_id")
      .eq("slug", companySlug)
      .maybeSingle();

    if (existingSlug) {
      return NextResponse.json({ success: false, error: `The subdomain "${companySlug}" is already in use by another company` }, { status: 400 });
    }

    // 4. Handle Auth Account (Use existing or create new)
    const { data: existingAccount } = await adminClient
      .from("auth_accounts")
      .select("account_id")
      .eq("email", companyAuthId)
      .maybeSingle();

    let accountId: string;

    if (existingAccount) {
      // Use existing account (e.g. if user is already a Platform Admin)
      accountId = existingAccount.account_id;
    } else {
      // Create new Auth Account
      const hashedPassword = await hashPassword(companyPassword);
      const { data: newAccount, error: accountError } = await adminClient
        .from("auth_accounts")
        .insert({
          email: companyAuthId,
          password_hash: hashedPassword,
          account_type: 'company_user'
        })
        .select("account_id")
        .single();

      if (accountError || !newAccount) {
        return NextResponse.json({ success: false, error: "Failed to create auth account" }, { status: 500 });
      }
      accountId = newAccount.account_id;
    }

    // 5. Create Company
    const { data: company, error: companyError } = await adminClient
      .from("companies")
      .insert({
        company_name: companyName,
        plan_code: planCode || "FREE TRIAL",
        status: "Active"
      })
      .select("company_id")
      .single();

    if (companyError || !company) {
      return NextResponse.json({ success: false, error: companyError?.message || "Failed to create company" }, { status: 500 });
    }

    const companyId = company.company_id;

    // 6. Create Default Roles (Superadmin, Admin, Staff)
    const defaultRoles = [
      { company_id: companyId, role_name: "Superadmin", is_super_admin: true },
      { company_id: companyId, role_name: "Admin", is_super_admin: false },
      { company_id: companyId, role_name: "Staff", is_super_admin: false }
    ];

    const { data: roles, error: rolesError } = await adminClient
      .from("roles")
      .insert(defaultRoles)
      .select("role_id, role_name");

    if (rolesError || !roles) {
       return NextResponse.json({ success: false, error: "Failed to create default roles: " + rolesError?.message }, { status: 500 });
    }

    // Find the Superadmin role ID to link the first user
    const superadminRole = roles.find(r => r.role_name === "Superadmin");

    // 7. Create User record (linked to auth account and Superadmin role)
    const { error: userError } = await adminClient
      .from("users")
      .insert({
        account_id: accountId,
        company_id: companyId,
        role_id: superadminRole?.role_id,
        user_email: companyAuthId,
        full_name: "Company Superadmin",
        user_status: "Active"
      });

    if (userError) {
      return NextResponse.json({ success: false, error: "Failed to create user record: " + userError.message }, { status: 500 });
    }

    // 8. Register company subdomain in allowed_subdomains
    const { error: subdomainError } = await adminClient
      .from("allowed_subdomains")
      .insert({
        slug: companySlug,
        company_id: companyId,
        is_active: true,
      });

    if (subdomainError) {
      // Non-fatal: log but don't fail company creation. Admin can fix manually.
      console.error("POST /api/company: Failed to register subdomain:", subdomainError.message);
    }

    return NextResponse.json({
      success: true,
      action: "created",
      companyId: companyId,
      companySlug: companySlug,
    }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("POST /api/company error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.accountType !== 'platform_admin') {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    
    // Fetch companies and join with users/roles to find superadmins
    const { data: companies, error } = await adminClient
      .from("companies")
      .select(`
        *,
        users (
          user_id,
          user_email,
          full_name,
          roles!inner (
            role_name,
            is_super_admin
          )
        )
      `)
      .eq('users.roles.is_super_admin', true)
      .order("created_on", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Format companies and their superadmins
    const formattedCompanies = (companies || []).map(c => {
      const superadmins = (c.users || []).map((u: any) => ({
        userId: u.user_id,
        email: u.user_email,
        fullName: u.full_name
      }));
      
      return {
        ...c,
        superadmins,
        // For backwards compatibility in UI if needed
        companyAuthId: superadmins[0]?.email || "N/A"
      };
    });

    return NextResponse.json({
      success: true,
      companies: formattedCompanies,
    }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/company error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.accountType !== 'platform_admin') {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { company_id, companyAuthId, companyPassword, ...otherUpdates } = body;

    if (!company_id) {
      return NextResponse.json({ success: false, error: "company_id is required" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 1. Update auth_accounts if needed
    if (companyAuthId || companyPassword) {
      // Find the account_id via users table
      const { data: userData, error: userError } = await adminClient
        .from("users")
        .select("account_id")
        .eq("company_id", company_id)
        .limit(1)
        .single();

      if (!userError && userData?.account_id) {
        const authUpdates: any = {};
        if (companyAuthId) authUpdates.email = companyAuthId;
        if (companyPassword) {
          authUpdates.password_hash = await hashPassword(companyPassword);
        }

        const { error: authError } = await adminClient
          .from("auth_accounts")
          .update(authUpdates)
          .eq("account_id", userData.account_id);

        if (authError) {
          return NextResponse.json({ success: false, error: "Failed to update auth credentials: " + authError.message }, { status: 500 });
        }
      }
    }

    // 2. Update company info
    if (Object.keys(otherUpdates).length > 0) {
      const { error: companyError } = await adminClient
        .from("companies")
        .update(otherUpdates)
        .eq("company_id", company_id);

      if (companyError) {
        return NextResponse.json({ success: false, error: "Failed to update company info: " + companyError.message }, { status: 500 });
      }
    }

    // 3. Sync subdomain is_active if company status was changed
    if (otherUpdates.status !== undefined) {
      const isActive = otherUpdates.status === "Active";
      await adminClient
        .from("allowed_subdomains")
        .update({ is_active: isActive, updated_on: new Date().toISOString() })
        .eq("company_id", company_id);
      // Non-fatal: subdomain sync failure doesn't block the response.
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("PUT /api/company error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

