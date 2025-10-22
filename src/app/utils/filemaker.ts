// utils/filemaker.ts
import { requireEnv } from "./utility";

var FM_HOST = requireEnv("FM_HOST") || "kibiz.smtech.cloud";
var FM_VERSION = requireEnv("FM_VERSION") || "vLatest";
var FM_DATABASE = requireEnv("FM_DATABASE") || "KibiAI";
var FM_BASE_URL = `https://${FM_HOST}/fmi/data/${FM_VERSION}/databases/${FM_DATABASE}`;
var FM_USERNAME = requireEnv("FM_USERNAME");
var FM_PASSWORD = requireEnv("FM_PASSWORD");

/**
 * Sign in to FileMaker Data API
 */
export async function fmSignIn(
  username: string,
  password: string,
  server?: string
): Promise<string> {
  if (server) {
    FM_HOST = server;
  }

  const url = `https://${FM_HOST}/fmi/data/${FM_VERSION}/databases/${FM_DATABASE}/sessions`;

  const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`FileMaker sign-in failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data?.response?.token;
}

/**
 * Verify an existing FileMaker session token
 */
export async function fmVerifySession(
  token: string,
  server?: string
): Promise<boolean> {
  if (server) {
    FM_HOST = server;
  }

  const url = `https://${FM_HOST}/fmi/data/${FM_VERSION}/validateSession`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.ok;
}

/**
 * Fetch a record by ID
 */
export async function fmGetRecordById(
  layout: string,
  recordId: string,
  token: string,
  server?: string
): Promise<any> {
  if (server) {
    FM_HOST = server;
  }

  const url = `https://${FM_HOST}/fmi/data/${FM_VERSION}/databases/${FM_DATABASE}/layouts/${layout}/records/${recordId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch record: ${response.statusText}`);
  }

  const data = await response.json();
  return data?.response?.data?.[0]?.fieldData ?? null;
}

/**
 * Update a record by ID
 */
export async function fmSetRecordById(
  layout: string,
  recordId: string,
  fieldData: Record<string, any>,
  token: string,
  server?: string
): Promise<any> {
  if (server) {
    FM_HOST = server;
  }

  const url = `https://${FM_HOST}/fmi/data/${FM_VERSION}/databases/${FM_DATABASE}/layouts/${layout}/records/${recordId}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fieldData }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update record: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Sign out from FileMaker Data API
 */
export async function fmSignOut(
  token: string,
  server?: string
): Promise<boolean> {
  if (server) {
    FM_HOST = server;
  }

  const url = `https://${FM_HOST}/fmi/data/${FM_VERSION}/databases/${FM_DATABASE}/sessions/${token}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.ok;
}

////////////////////////////////////////////////////////////////////////////////
// NEW FUNCTIONS START HERE — (Auto-login, auto-logout, full JSON responses) //
////////////////////////////////////////////////////////////////////////////////

/**
 * Find multiple records (returns array, even if empty)
 */
export async function fmFindRecords(
  layout: string,
  query: Record<string, any>[],
  token?: string
): Promise<any[]> {
  let localToken = token;
  let autoSession = false;

  if (!localToken) {
    localToken = await fmSignIn(FM_USERNAME, FM_PASSWORD);
    autoSession = true;
  }

  const url = `${FM_BASE_URL}/layouts/${layout}/_find`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localToken}`,
    },
    body: JSON.stringify({ query }),
  });

  let result: any[] = [];

  if (res.ok) {
    const data = await res.json();
    result = data?.response?.data ?? [];
  }

  if (autoSession && localToken) {
    await fmSignOut(localToken);
  }

  return result;
}

/**
 * Find first record by a single field (returns first or null)
 */
export async function fmFindOne(
  layout: string,
  field: string,
  value: any,
  token?: string
): Promise<any | null> {
  const result = await fmFindRecords(
    layout,
    [{ [field]: `==${value}` }],
    token
  );
  return result?.[0] ?? null;
}

/**
 * Create a record (returns full FileMaker JSON)
 */
export async function fmCreateRecord(
  layout: string,
  fieldData: Record<string, any>,
  token?: string
): Promise<any> {
  let localToken = token;
  let autoSession = false;

  if (!localToken) {
    localToken = await fmSignIn(FM_USERNAME, FM_PASSWORD);
    autoSession = true;
  }

  const url = `${FM_BASE_URL}/layouts/${layout}/records`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localToken}`,
    },
    body: JSON.stringify({ fieldData }),
  });

  const data = await res.json();
  console.log("fmCreateRecord response:", data);

  if (autoSession && localToken) {
    await fmSignOut(localToken);
  }

  return data;
}

/**
 * Edit a record (returns full FileMaker JSON)
 */
export async function fmEditRecord(
  layout: string,
  recordId: string,
  fieldData: Record<string, any>,
  token?: string
): Promise<any> {
  let localToken = token;
  let autoSession = false;

  if (!localToken) {
    localToken = await fmSignIn(FM_USERNAME, FM_PASSWORD);
    autoSession = true;
  }

  const url = `${FM_BASE_URL}/layouts/${layout}/records/${recordId}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localToken}`,
    },
    body: JSON.stringify({ fieldData }),
  });

  const data = await res.json();

  if (autoSession && localToken) {
    await fmSignOut(localToken);
  }

  return data;
}

// Find all records in a layout (for admin use)
export async function fmFindAllRecords(
  layout: string,
  token?: string
): Promise<any[]> {
  let localToken = token;
  let autoSession = false;

  if (!localToken) {
    localToken = await fmSignIn(FM_USERNAME, FM_PASSWORD);
    autoSession = true;
  }

  const url = `${FM_BASE_URL}/layouts/${layout}/records`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localToken}`,
    },
  });

  let result: any[] = [];

  if (res.ok) {
    const data = await res.json();
    result = data?.response?.data ?? [];
  }

  if (autoSession && localToken) {
    await fmSignOut(localToken);
  }

  return result;
}
