import { fmFindOne } from "@/lib/utils/filemaker";
import { requireEnv } from "@/lib/utils/utility";

const FM_COMPANY_LAYOUT = requireEnv("FM_COMPANY_LAYOUT");
const FM_ADMIN_LAYOUT = requireEnv("FM_ADMIN_LAYOUT");

export type CompanyRow = {
  PrimaryKey?: string;
  CompanyID?: string;
  LicenseID?: string;
  CompanyAuthID?: string;
  CompanyPassword?: string;
  CompanyName?: string;
};

export type AdminRow = {
  admin_token?: string;
  name?: string;
  Scope?: number;
};

export async function verifyBearerToken(authHeader?: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return { ok: false as const, reason: "Missing bearer token" };

  const token = authHeader.split(" ")[1];
  const adminRec = await fmFindOne(FM_ADMIN_LAYOUT, "admin_token", token);

  if (!adminRec) return { ok: false as const, reason: "Invalid admin token" };

  return {
    ok: true as const,
    token,
    admin: adminRec.fieldData as AdminRow,
  };
}

export async function getCompanyByAuthId(authId: string) {
  const rec = await fmFindOne(FM_COMPANY_LAYOUT, "CompanyAuthID", authId);
  return rec ? (rec.fieldData as CompanyRow) : null;
}

export async function getCompanyByCompanyId(companyId: string) {
  const rec = await fmFindOne(FM_COMPANY_LAYOUT, "CompanyID", companyId);
  return rec ? (rec.fieldData as CompanyRow) : null;
}

export async function verifyBasicCompany(authHeader?: string | null) {
  if (!authHeader || !authHeader.startsWith("Basic "))
    return { ok: false as const, reason: "Missing basic auth" };

  try {
    const base64 = authHeader.split(" ")[1];
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx === -1)
      return { ok: false as const, reason: "Malformed basic auth" };

    const username = decoded.slice(0, idx);
    const password = decoded.slice(idx + 1);

    const companyRec = await fmFindOne(
      FM_COMPANY_LAYOUT,
      "CompanyAuthID",
      username
    );
    if (!companyRec)
      return { ok: false as const, reason: "Invalid company auth id" };

    const fieldData = companyRec.fieldData as CompanyRow;
    const pwd = fieldData.CompanyPassword ?? "";

    if (password !== pwd)
      return { ok: false as const, reason: "Invalid password" };

    return { ok: true as const, companyRec: fieldData };
  } catch {
    return { ok: false as const, reason: "Failed to decode basic auth" };
  }
}
