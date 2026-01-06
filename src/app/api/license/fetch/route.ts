import { jsonResponse, requireEnv } from "@/lib/utils/utility";
import { fmFindOne } from "@/lib/utils/filemaker";
import { verifyBasicCompany } from "@/lib/auth";

const FM_LICENSE_LAYOUT = requireEnv("FM_LICENSE_LAYOUT");

// ✅ Helper to add CORS headers to all responses
function withCORS(response: Response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  return response;
}

// ✅ Handle preflight CORS requests
export async function OPTIONS() {
  const res = new Response(null, { status: 204 });
  return withCORS(res);
}

export async function POST(req: Request) {
  const auth = await verifyBasicCompany(req.headers.get("authorization"));
  if (!auth.ok)
    return withCORS(jsonResponse(401, { success: false, error: auth.reason }));

  const company = auth.companyRec!;
  const companyId = company.CompanyID!;
  const licenseId = company.LicenseID;

  if (!licenseId) {
    return withCORS(
      jsonResponse(200, {
        success: true,
        company: {
          companyId: company.CompanyID,
          companyName: company.CompanyName,
        },
        license: null,
      })
    );
  }

  const licenseRec = await fmFindOne(FM_LICENSE_LAYOUT, "LicenseID", licenseId);

  if (!licenseRec) {
    return withCORS(
      jsonResponse(200, {
        success: true,
        company: {
          companyId: company.CompanyID,
          companyName: company.CompanyName,
        },
        license: null,
      })
    );
  }

  if (licenseRec.fieldData.CompanyID !== companyId) {
    return withCORS(
      jsonResponse(409, {
        success: false,
        error: "License does not belong to this company",
      })
    );
  }

  const f = licenseRec.fieldData;

  return withCORS(
    jsonResponse(200, {
      success: true,
      company: {
        companyId: company.CompanyID,
        companyName: company.CompanyName,
      },
      license: {
        licenseId: f.LicenseID,
        companyId: f.CompanyID,
        plan: f.Plan,
        price: f.Price,
        users: f.Users,
        workspaces: f.Workspaces,
        reports: f.Reports,
        charts: f.Charts,
        AI_Features: f.AI_Features,
        licensingTerms: f.LicensingTerms,
        support: f.Support,
        isActive: f.isActive,
        expiryDate: f.ExpiryDate,
      },
    })
  );
}

export async function GET(req: Request) {
  const auth = await verifyBasicCompany(req.headers.get("authorization"));
  if (!auth.ok)
    return withCORS(jsonResponse(401, { success: false, error: auth.reason }));

  const url = new URL(req.url);
  const licenseId = url.searchParams.get("licenseId");
  const company = auth.companyRec!;
  const companyId = company.CompanyID!;

  if (!licenseId) {
    return withCORS(
      jsonResponse(400, {
        success: false,
        error: "Missing required query parameter: licenseId",
      })
    );
  }

  const licenseRec = await fmFindOne(FM_LICENSE_LAYOUT, "LicenseID", licenseId);

  if (!licenseRec) {
    return withCORS(
      jsonResponse(200, {
        success: true,
        company: {
          companyId: company.CompanyID,
          companyName: company.CompanyName,
        },
        license: null,
      })
    );
  }

  if (licenseRec.fieldData.CompanyID !== companyId) {
    return withCORS(
      jsonResponse(409, {
        success: false,
        error: "License does not belong to this company",
      })
    );
  }

  const f = licenseRec.fieldData;

  return withCORS(
    jsonResponse(200, {
      success: true,
      company: {
        companyId: company.CompanyID,
        companyName: company.CompanyName,
      },
      license: {
        licenseId: f.LicenseID,
        companyId: f.CompanyID,
        plan: f.Plan,
        price: f.Price,
        users: f.Users,
        workspaces: f.Workspaces,
        reports: f.Reports,
        charts: f.Charts,
        AI_Features: f.AI_Features,
        licensingTerms: f.LicensingTerms,
        support: f.Support,
        isActive: f.isActive,
        expiryDate: f.ExpiryDate,
      },
    })
  );
}
