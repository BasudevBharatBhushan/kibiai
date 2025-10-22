import { jsonResponse, requireEnv } from "@/app/utils/utility";
import { fmFindOne } from "@/app/utils/filemaker";
import { verifyBasicCompany } from "@/lib/auth";

const FM_LICENSE_LAYOUT = requireEnv("FM_LICENSE_LAYOUT");

export async function POST(req: Request) {
  // 1. Verify Basic Auth
  const auth = await verifyBasicCompany(req.headers.get("authorization"));
  if (!auth.ok)
    return jsonResponse(401, { success: false, error: auth.reason });

  const company = auth.companyRec!;
  const companyId = company.CompanyID!;
  const licenseId = company.LicenseID;

  // ✅ If company has no license yet, do NOT throw error
  if (!licenseId) {
    return jsonResponse(200, {
      success: true,
      company: {
        companyId: company.CompanyID,
        companyName: company.CompanyName,
      },
      license: null,
    });
  }

  // 2. Fetch license
  const licenseRec = await fmFindOne(FM_LICENSE_LAYOUT, "LicenseID", licenseId);

  // ✅ If license record is missing, still return company with license=null
  if (!licenseRec) {
    return jsonResponse(200, {
      success: true,
      company: {
        companyId: company.CompanyID,
        companyName: company.CompanyName,
      },
      license: null,
    });
  }

  // 3. Validate ownership
  if (licenseRec.fieldData.CompanyID !== companyId) {
    return jsonResponse(409, {
      success: false,
      error: "License does not belong to this company",
    });
  }

  const f = licenseRec.fieldData;

  // ✅ Return license normally when it exists
  return jsonResponse(200, {
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
  });
}
