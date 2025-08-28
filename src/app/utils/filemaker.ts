// utils/filemaker.ts

const FM_HOST = "kibiz.smtech.cloud";
const FM_VERSION = "vLatest";
const FM_DATABASE = "KibiAI";

/**
 * Sign in to FileMaker Data API
 * @param username - FileMaker account username
 * @param password - FileMaker account password
 * @returns {Promise<string>} - Session token
 */
export async function fmSignIn(
  username: string,
  password: string
): Promise<string> {
  const url = `https://${FM_HOST}/fmi/data/${FM_VERSION}/databases/${FM_DATABASE}/sessions`;

  //Base64 encode username:password
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
 * @param token - FileMaker session token
 * @returns {Promise<boolean>} - Whether the token is valid
 */
export async function fmVerifySession(token: string): Promise<boolean> {
  const url = `https://${FM_HOST}/fmi/data/${FM_VERSION}/validateSession`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.ok;
}

/**
 * Fetch a record by ID
 * @param layout - FileMaker layout name
 * @param recordId - Record ID
 * @param token - FileMaker session token
 * @returns {Promise<any>} - Field data of the record
 */
export async function fmGetRecordById(
  layout: string,
  recordId: string,
  token: string
): Promise<any> {
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
  console.log("Fetch response:", data);

  return data?.response?.data?.[0]?.fieldData ?? null;
}

/**
 * Update a record by ID
 * @param layout - FileMaker layout name
 * @param recordId - Record ID
 * @param fieldData - Object containing field names & values
 * @param token - FileMaker session token
 * @returns {Promise<any>} - Update response
 */
export async function fmSetRecordById(
  layout: string,
  recordId: string,
  fieldData: Record<string, any>,
  token: string
): Promise<any> {
  //   console.log("Update fieldData:", fieldData);

  const url = `https://${FM_HOST}/fmi/data/${FM_VERSION}/databases/${FM_DATABASE}/layouts/${layout}/records/${recordId}`;

  console.log("Update URL:", url);

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
 * @param token - FileMaker session token
 * @returns {Promise<boolean>} - Whether sign-out succeeded
 */
export async function fmSignOut(token: string): Promise<boolean> {
  const url = `https://${FM_HOST}/fmi/data/${FM_VERSION}/databases/${FM_DATABASE}/sessions/${token}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.ok;
}
