import { jsonResponse, requireEnv } from "@/lib/utils/utility";
import { fmFindOne, fmCreateRecord, fmEditRecord } from "@/lib/utils/filemaker";
import { verifyBearerToken, getCompanyByCompanyId } from "@/lib/auth/auth";

const FM_LICENSE_LAYOUT = requireEnv("FM_LICENSE_LAYOUT");
const FM_COMPANY_LAYOUT = requireEnv("FM_COMPANY_LAYOUT");

type LicenseBody = {
  licenseId?: string;
  companyId?: string;
  plan?: string;
  price?: string;
  users?: string;
  workspaces?: string;
  reports?: string;
  charts?: string;
  AI_Features?: string;
  licensingTerms?: string;
  support?: string;
  isActive?: number;
  expiryDate?: string;
};

export async function POST(req: Request) {
  try {
    // 1. Verify Bearer Token
    const auth = await verifyBearerToken(req.headers.get("authorization"));
    if (!auth.ok)
      return jsonResponse(401, { success: false, error: auth.reason });

    // 2. Parse body
    let body: LicenseBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { success: false, error: "Invalid JSON body" });
    }

    const {
      licenseId,
      companyId,
      plan,
      price,
      users,
      workspaces,
      reports,
      charts,
      AI_Features,
      licensingTerms,
      support,
      isActive,
      expiryDate,
    } = body;

    const toFieldData = () => {
      const f: Record<string, any> = {};
      if (plan !== undefined) f.Plan = plan;
      if (price !== undefined) f.Price = price;
      if (users !== undefined) f.Users = users;
      if (workspaces !== undefined) f.Workspaces = workspaces;
      if (reports !== undefined) f.Reports = reports;
      if (charts !== undefined) f.Charts = charts;
      if (AI_Features !== undefined) f.AI_Features = AI_Features;
      if (licensingTerms !== undefined) f.LicensingTerms = licensingTerms;
      if (support !== undefined) f.Support = support;
      if (isActive !== undefined) f.isActive = isActive;
      if (expiryDate !== undefined) f.ExpiryDate = expiryDate;
      return f;
    };

    // ✅ CREATE
    if (!licenseId) {
      if (!companyId) {
        return jsonResponse(400, {
          success: false,
          error: "companyId is required for create",
        });
      }

      // Fetch full company record so we have recordId
      const companyRec = await fmFindOne(
        FM_COMPANY_LAYOUT,
        "CompanyID",
        companyId
      );
      if (!companyRec)
        return jsonResponse(404, {
          success: false,
          error: "Company not found",
        });

      // recordId must be used for edit
      const companyRecordId = companyRec.recordId;
      const companyData = companyRec.fieldData;

      console.log("Company data for license creation:", companyData);

      // ✅ Prevent duplicate license creation
      if (companyData.LicenseID) {
        return jsonResponse(409, {
          success: false,
          error: "Company already has an active license",
        });
      }

      const newId = `KIBIAI-${Math.random()
        .toString(36)
        .slice(2, 10)
        .toUpperCase()}`;

      const fieldData = {
        ...toFieldData(),
        LicenseID: newId,
        CompanyID: companyId,
      };

      const created = await fmCreateRecord(FM_LICENSE_LAYOUT, fieldData);
      if (created?.messages?.[0]?.code !== "0") {
        return jsonResponse(500, {
          success: false,
          error: "Failed to create license record",
          detail: created,
        });
      }

      const linkUpdate = await fmEditRecord(
        FM_COMPANY_LAYOUT,
        companyRecordId,
        {
          LicenseID: newId,
        }
      );

      if (linkUpdate?.messages?.[0]?.code !== "0") {
        return jsonResponse(500, {
          success: false,
          error: "License created but failed to link to company",
          detail: linkUpdate,
        });
      }

      return jsonResponse(200, {
        success: true,
        action: "created",
        licenseId: newId,
        companyId,
        scope: fieldData,
        recordId: created?.response?.recordId,
      });
    }

    // ✅ UPDATE
    const existing = await fmFindOne(FM_LICENSE_LAYOUT, "LicenseID", licenseId);
    if (!existing)
      return jsonResponse(404, { success: false, error: "License not found" });

    const existingCompanyId = existing.fieldData.CompanyID;
    if (!companyId || companyId !== existingCompanyId) {
      return jsonResponse(409, {
        success: false,
        error: "License does not belong to provided companyId",
      });
    }

    // recordId is required for update
    const licenseRecordId = existing.recordId;

    const update = toFieldData();
    if (Object.keys(update).length === 0)
      return jsonResponse(400, { success: false, error: "Nothing to update" });

    const updated = await fmEditRecord(
      FM_LICENSE_LAYOUT,
      licenseRecordId,
      update
    );
    if (updated?.messages?.[0]?.code !== "0") {
      return jsonResponse(500, {
        success: false,
        error: "Failed to update license record",
        detail: updated,
      });
    }

    return jsonResponse(200, {
      success: true,
      action: "updated",
      licenseId,
      companyId,
    });
  } catch (err: any) {
    return jsonResponse(500, {
      success: false,
      error: "Server error in /api/license",
      detail: err?.message ?? err,
    });
  }
}
