import { jsonResponse } from "@/lib/utils/utility";
import {
  fmFindOne,
  fmCreateRecord,
  fmEditRecord,
  fmFindAllRecords,
} from "@/lib/utils/filemaker";
import { verifyBearerToken } from "@/lib/auth/auth";
import { requireEnv } from "@/lib/utils/utility";

const FM_COMPANY_LAYOUT = requireEnv("FM_COMPANY_LAYOUT");

type CompanyBody = {
  companyId?: string;
  companyAuthId?: string;
  companyPassword?: string; // used only in create
  companyName?: string;
};

export async function POST(req: Request) {
  // 1. Verify Bearer Token
  const auth = await verifyBearerToken(req.headers.get("authorization"));
  if (!auth.ok)
    return jsonResponse(401, { success: false, error: auth.reason });

  // 2. Parse JSON
  let body: CompanyBody;

  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { success: false, error: "Invalid JSON body" });
  }

  console.log(body);

  const { companyId, companyAuthId, companyPassword, companyName } = body;
  if (!companyId)
    return jsonResponse(400, {
      success: false,
      error: "companyId is required",
    });

  // 3. Check if exists
  const existing = await fmFindOne(FM_COMPANY_LAYOUT, "CompanyID", companyId);

  if (!existing) {
    // CREATE
    if (!companyAuthId || !companyPassword) {
      return jsonResponse(400, {
        success: false,
        error: "companyAuthId and companyPassword are required for create",
      });
    }

    const fieldData = {
      CompanyID: companyId,
      CompanyAuthID: companyAuthId,
      CompanyPassword: companyPassword,
      CompanyName: companyName || "",
      LicenseID: "",
    };

    console.log(fieldData);

    const created = await fmCreateRecord(FM_COMPANY_LAYOUT, fieldData);
    return jsonResponse(200, {
      success: true,
      action: "created",
      companyId,
      recordId: created?.response?.recordId,
    });
  }

  // UPDATE (password updates disabled)
  if (!companyAuthId) {
    return jsonResponse(400, {
      success: false,
      error: "Nothing to update",
    });
  }

  const update = {
    CompanyAuthID: companyAuthId,
    CompanyPassword: companyPassword,
  };
  await fmEditRecord(FM_COMPANY_LAYOUT, existing.recordId, update);

  return jsonResponse(200, {
    success: true,
    action: "updated",
    companyId,
  });
}

export async function GET(req: Request) {
  // 1. Verify Bearer Token
  const auth = await verifyBearerToken(req.headers.get("authorization"));
  if (!auth.ok)
    return jsonResponse(401, { success: false, error: auth.reason });

  // 2. Fetch all companies
  const records = await fmFindAllRecords(FM_COMPANY_LAYOUT);

  if (!records || records.length === 0) {
    return jsonResponse(200, {
      success: true,
      companies: [],
      message: "No companies found",
    });
  }

  // 3. Normalize response for frontend
  const companies = records.map((rec: any) => ({
    recordId: rec.recordId,
    ...rec.fieldData,
  }));

  return jsonResponse(200, {
    success: true,
    companies,
  });
}
