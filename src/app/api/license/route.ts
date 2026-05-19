import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { getSession } from "@/utils/auth";

const mapDBToFrontend = (dbLicense: any) => {
  if (!dbLicense) return null;
  return {
    licenseId: dbLicense.license_id,
    companyId: dbLicense.company_id,
    plan: dbLicense.plan_name,
    price: dbLicense.price ? parseFloat(dbLicense.price.toString()).toString() : "0",
    users: dbLicense.users_limit?.toString(),
    workspaces: dbLicense.workspaces_limit?.toString(),
    reports: dbLicense.reports_limit?.toString(),
    charts: dbLicense.charts_limit?.toString(),
    AI_Features: dbLicense.ai_features,
    licensingTerms: dbLicense.licensing_terms,
    support: dbLicense.support_level,
    isActive: dbLicense.is_active ? 1 : 0,
    expiryDate: dbLicense.expiry_date ? new Date(dbLicense.expiry_date).toLocaleDateString('en-US') : undefined
  };
};

const mapFrontendToDB = (feLicense: any) => {
  const db: any = {};
  if (feLicense.companyId) db.company_id = feLicense.companyId;
  if (feLicense.plan) db.plan_name = feLicense.plan;
  if (feLicense.price !== undefined) db.price = parseFloat(feLicense.price) || 0;
  if (feLicense.users !== undefined) db.users_limit = parseInt(feLicense.users) || 0;
  if (feLicense.workspaces !== undefined) db.workspaces_limit = parseInt(feLicense.workspaces) || 0;
  if (feLicense.reports !== undefined) db.reports_limit = parseInt(feLicense.reports) || 0;
  if (feLicense.charts !== undefined) db.charts_limit = parseInt(feLicense.charts) || 0;
  if (feLicense.AI_Features) db.ai_features = feLicense.AI_Features;
  if (feLicense.licensingTerms) db.licensing_terms = feLicense.licensingTerms;
  if (feLicense.support) db.support_level = feLicense.support;
  if (feLicense.isActive !== undefined) db.is_active = feLicense.isActive === 1;
  if (feLicense.expiryDate) db.expiry_date = new Date(feLicense.expiryDate).toISOString();
  return db;
};

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.accountType !== 'platform_admin') {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('company_id');

    if (!companyId) {
      return NextResponse.json({ success: false, error: "company_id is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("licenses")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, license: mapDBToFrontend(data) });
  } catch (err: any) {
    console.error("GET /api/license error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.accountType !== 'platform_admin') {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const dbBody = mapFrontendToDB(body);
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from("licenses")
      .insert(dbBody)
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, license: mapDBToFrontend(data) });
  } catch (err: any) {
    console.error("POST /api/license error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.accountType !== 'platform_admin') {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { license_id, company_id, ...updates } = body;
    const dbUpdates = mapFrontendToDB(updates);

    const actualLicenseId = license_id || updates.licenseId;

    if (!actualLicenseId) return NextResponse.json({ success: false, error: "license_id is required" }, { status: 400 });

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("licenses")
      .update(dbUpdates)
      .eq("license_id", actualLicenseId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, license: mapDBToFrontend(data) });
  } catch (err: any) {
    console.error("PUT /api/license error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}



