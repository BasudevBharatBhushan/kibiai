// Utility functions for handling FileMaker records and OData batch responses

interface FileMakerRecord {
  fieldData: Record<string, any>;
  portalData: Record<string, any>;
  recordId: string;
  modId: string;
}

interface FlattenedRecord extends Record<string, any> {
  recordId: string;
}

export interface FetchFmDataRequest {
  raw_dataset?: any;
  p_key_field?: string;
  p_keys?: string[];
  filter?: Record<string, string>;
  table: string;
  host: string;
  database: string;
  version: string;
  data_fetching_protocol: string;
  session_token?: string;
}

export function flattenFileMakerRecords(
  records: FileMakerRecord[]
): FlattenedRecord[] {
  return records.map((record) => ({
    ...record.fieldData,
    recordId: record.recordId,
  }));
}

export function parseODataBatchResponse(response: string): {
  records: any[];
  recordCount: number;
} {
  // Extract boundary from the response (looks for --b_ pattern)
  const boundaryMatch = response.match(/--b_[^\n\r]+/);
  if (!boundaryMatch) {
    throw new Error("No boundary found in response");
  }

  // console.log(response);

  const boundary = boundaryMatch[0];

  // Split response by boundary
  const parts = response.split(boundary);

  // Array to store all flattened records
  const results = [];
  let recordCount = 0;

  // Process each part
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Find JSON block (content between first { and last })
    const startPos = part.indexOf("{");
    const lastBracePos = part.lastIndexOf("}");

    if (startPos === -1 || lastBracePos === -1 || startPos >= lastBracePos) {
      continue; // Skip parts without valid JSON
    }

    const jsonBlock = part.substring(startPos, lastBracePos + 1);

    try {
      // Clean the JSON block by replacing invalid '?' values with null
      // This handles cases where '?' appears as a value (e.g., "QtyAvailable": ?)
      const cleanedJsonBlock = jsonBlock.replace(
        /:\s*\?(?=\s*[,}])/g,
        ": null"
      );

      // Parse the cleaned JSON block
      const parsedJson = JSON.parse(cleanedJsonBlock);

      // Extract the "value" array if it exists
      if (parsedJson.value && Array.isArray(parsedJson.value)) {
        // Add all records from this part's "value" array to results
        results.push(...parsedJson.value);
      }
      recordCount++;
    } catch (error: any) {
      // Skip invalid JSON blocks
      console.warn("Invalid JSON block found, skipping:", error.message);
      continue;
    }
  }

  let result: any = {};
  result.json = { records: results, recordCount };
  return result.json;
}

export function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  // Handle MM/DD/YYYY format
  const parts = dateStr.split("/");
  if (parts.length !== 3) return false;
  const m = parseInt(parts[0], 10);
  const d = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (isNaN(m) || isNaN(d) || isNaN(y)) return false;
  if (y < 1000 || y > 9999) return false;
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

export function validateFmDateFilter(value: string): {
  isValid: boolean;
  error?: string;
} {
  if (!value) return { isValid: true };

  if (value.includes("...")) {
    const [start, end] = value.split("...").map((v) => v.trim());
    if (start && !isValidDate(start))
      return { isValid: false, error: `Invalid start date: ${start}` };
    if (end && !isValidDate(end))
      return { isValid: false, error: `Invalid end date: ${end}` };
    return { isValid: true };
  }

  // Handle other operators like >, <, >=, <=, =
  const dateOnly = value.replace(/^[><=]+/, "").trim();
  if (dateOnly && dateOnly !== "*" && !isValidDate(dateOnly)) {
    return { isValid: false, error: `Invalid date: ${dateOnly}` };
  }

  return { isValid: true };
}

function convertOperator(value: string, key: string) {
  if (value.includes("...")) {
    const [d1, d2] = value.split("...").map((v) => v.trim());
    return `ge '${d1}' and ${key} le '${d2}'`;
  }
  if (value.startsWith("!=")) return `ne '${value.slice(2).trim()}'`;
  if (value.startsWith(">=")) return `ge ${value.slice(2).trim()}`;
  if (value.startsWith(">")) return `gt ${value.slice(1).trim()}`;
  if (value.startsWith("<=")) return `le ${value.slice(2).trim()}`;
  if (value.startsWith("<")) return `lt ${value.slice(1).trim()}`;
  if (value.startsWith("==")) return `eq ${value.slice(2).trim()}`;
  if (value.startsWith("=")) return `eq ${value.slice(1).trim()}`;
  if (value === "*") return `ne null`;
  if (value === "") return `eq null`;
  return `contains(${key},'${value.trim()}')`;
}

function buildFileMakerQueries(
  filter: Record<string, string>,
  p_key_field?: string,
  p_keys?: string[]
): Record<string, any>[] {
  const normalFilter: Record<string, string> = {};
  const notEqualEntries: Array<{ field: string; value: string }> = [];

  for (const [field, val] of Object.entries(filter)) {
    if (String(val).startsWith("!=")) {
      notEqualEntries.push({ field, value: String(val).slice(2).trim() });
    } else {
      normalFilter[field] = val;
    }
  }

  const queries: Record<string, any>[] = [];

  if (p_keys && p_keys.length > 0 && p_key_field) {
    p_keys.forEach(pk => queries.push({ [p_key_field]: pk, ...normalFilter }));
    if (notEqualEntries.length > 0) {
      p_keys.forEach(pk =>
        notEqualEntries.forEach(({ field, value }) =>
          queries.push({ [p_key_field]: pk, ...normalFilter, [field]: value, omit: "true" })
        )
      );
    }
  } else {
    queries.push(normalFilter);
    notEqualEntries.forEach(({ field, value }) =>
      queries.push({ ...normalFilter, [field]: value, omit: "true" })
    );
  }

  return queries;
}

function normalizeFindFilters(filter?: Record<string, string>) {
  if (!filter) return undefined;

  const normalized: Record<string, string> = {};
  for (const [field, rawValue] of Object.entries(filter)) {
    const value = String(rawValue ?? "");
    normalized[field] = value.startsWith("==") ? `=${value.slice(2)}` : value;
  }

  return normalized;
}

export async function fetchFmRecord(
  reqBody: FetchFmDataRequest,
  basic_token: string
) {
  const {
    p_key_field,
    p_keys,
    filter: rawFilter,
    table,
    host,
    database,
    version,
    data_fetching_protocol,
    session_token,
  } = reqBody;

  const filter = normalizeFindFilters(rawFilter);

  // console.log(reqBody);
  // --- ODATA API Flow ---
  if (
    data_fetching_protocol === "odataapi" ||
    data_fetching_protocol === "o-data-api"
  ) {
    const batchBoundary = `b_${crypto.randomUUID()}`;
    let batchBody = "";

    if (p_keys && p_keys.length > 0) {
      if (!p_key_field)
        throw new Error("p_key_field is required when p_keys are provided");

      p_keys.forEach((pk, index) => {
        const queryParts: string[] = [];

        if (filter) {
          for (const key in filter) {
            const val = filter[key];
            queryParts.push(`${key} ${convertOperator(val, key)}`);
          }
        }
        queryParts.push(`${p_key_field} eq '${pk}'`);

        const filterQuery = queryParts.join(" and ");

        batchBody +=
          `--${batchBoundary}\n` +
          `Content-Type: application/http\n` +
          `Content-ID: ${index + 1}\n\n` +
          `GET /fmi/odata/${version}/${database}/${table}?filter=${filterQuery} HTTP/1.1\n` +
          `Content-Length: 0\n\n\n`;
      });
      batchBody += `--${batchBoundary}--`;
    } else {
      const queryParts: string[] = [];
      if (filter) {
        for (const key in filter) {
          const val = filter[key];
          queryParts.push(`${key} ${convertOperator(val, key)}`);
        }
      }
      const filterQuery = queryParts.length
        ? `?filter=${queryParts.join(" and ")}`
        : "";

      batchBody =
        `--${batchBoundary}\n` +
        `Content-Type: application/http\n` +
        `Content-ID: 1\n\n` +
        `GET /fmi/odata/${version}/${database}/${table}${filterQuery} HTTP/1.1\n` +
        `Content-Length: 0\n\n\n` +
        `--${batchBoundary}--`;
    }

    const odataUrl = `https://${host}/fmi/odata/${version}/${database}/$batch`;

    const odataRes = await fetch(odataUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic_token}`,
        "Content-Type": `multipart/mixed; boundary=${batchBoundary}`,
      },
      body: batchBody,
    });

    if (!odataRes.ok)
      throw new Error(`Failed to fetch data via OData: ${odataRes.status}`);

    const odataData = await odataRes.text();
    const parsedData = parseODataBatchResponse(odataData);

    return {
      data: parsedData.records,
      recordCount: parsedData.recordCount,
    };
  }

  // --- DATA API Flow ---
  if (
    data_fetching_protocol !== "dataapi" &&
    data_fetching_protocol !== "data-api"
  ) {
    throw new Error("Unsupported protocol");
  }

  let token = session_token;

  // Step 1: Validate token
  let isTokenValid = false;
  if (token) {
    const validateUrl = `https://${host}/fmi/data/${version}/validateSession`;
    const validateRes = await fetch(validateUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    isTokenValid = validateRes.ok;
  }

  // Step 2: Login if token is invalid or missing
  if (!isTokenValid) {
    const loginUrl = `https://${host}/fmi/data/${version}/databases/${database}/sessions`;
    const loginRes = await fetch(loginUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!loginRes.ok)
      throw new Error("Failed to authenticate with FileMaker Data API");

    const loginData = await loginRes.json();
    token = loginData.response.token;
  }

  // console.log("Using token:", token);
  // console.log(filter);

  // Step 3: Prepare find or get request
  let fetchUrl = `https://${host}/fmi/data/${version}/databases/${database}/layouts/${table}/records?_offset=1&_limit=100000`;
  let method = "GET";
  let body: any = undefined;

  if (
    (filter && Object.keys(filter).length > 0) ||
    (p_keys && p_keys.length > 0)
  ) {
    fetchUrl = `https://${host}/fmi/data/${version}/databases/${database}/layouts/${table}/_find`;
    method = "POST";

    if (p_keys && p_keys.length > 0) {
      if (!p_key_field)
        throw new Error("p_key_field is required when p_keys are provided");
      const queries = buildFileMakerQueries(filter || {}, p_key_field, p_keys);
      body = JSON.stringify({ query: queries, offset: 1, limit: 100000 });
    } else {
      const queries = buildFileMakerQueries(filter || {});
      body = JSON.stringify({ query: queries, offset: 1, limit: 100000 });
    }
  }
  // console.log("Fetch URL:", fetchUrl);
  // Step 4: Fetch data
  const dataRes = await fetch(fetchUrl, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body } : {}),
  });

  if (!dataRes.ok) {
    if (dataRes.status === 401) {
      return {
        token,
        data: [],
        recordCount: 0,
      };
    }

    // FileMaker Data API returns HTTP 500 with errorCode "401" when a _find
    // request yields zero matching records. This is a known FileMaker quirk â€”
    // it is NOT a real server error. Detect this and return an empty dataset
    // gracefully instead of crashing the entire report generation pipeline.
    if (dataRes.status === 500) {
      try {
        const errBody = await dataRes.json();
        const fmErrorCode =
          errBody?.messages?.[0]?.code ||
          errBody?.response?.messages?.[0]?.code ||
          null;
          
        console.log(`[DEBUG] caught FM 500 error. Code: ${fmErrorCode}`);

        if (fmErrorCode === "401" || fmErrorCode === 401) {
          console.log(`[DEBUG] Treating FM 500/401 as empty dataset.`);
          // FM error 401 = "No records match the request" â€” treat as empty result
          return {
            token,
            data: [],
            recordCount: 0,
          };
        }
      } catch (err) {
        console.log(`[DEBUG] Failed to parse FM 500 error body:`, err);
      }
    }

    throw new Error(`Failed to fetch data from FileMaker: ${dataRes.status}`);
  }

  // console.log(body);

  const data = await dataRes.json();

  // Step 5: Extract the fieldData and put in a flat array
  const FlattenedRecord = data.response
    ? flattenFileMakerRecords(data.response.data)
    : [];

  return {
    token,
    data: FlattenedRecord,
    recordCount: data.response?.dataInfo?.foundCount || 0,
  };
}

/**
 * Closes a FileMaker Data API session immediately after a fetch.
 * Uses the per-table host/database so it works for any client FM server.
 * Fire-and-forget: warns on failure but never throws.
 */
export async function closeFmSession(
  token: string,
  host: string,
  database: string,
  version: string = "vLatest"
): Promise<void> {
  try {
    const url = `https://${host}/fmi/data/${version}/databases/${database}/sessions/${token}`;
    await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.warn(`[closeFmSession] Failed to close FM session: ${err}`);
  }
}

export function jsonResponse(status: number, body: unknown) {

  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function parseBasicAuth(header?: string | null) {
  if (!header || !header.startsWith("Basic ")) return null;
  const base64 = header.split(" ")[1];
  try {
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx === -1) return null;
    return {
      username: decoded.slice(0, idx),
      password: decoded.slice(idx + 1),
    };
  } catch {
    return null;
  }
}

export function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) {
    // Only throw if we're not in the build phase
    // In Next.js, static generation happens in 'production' but during 'next build'
    // We can check if we are on the server and if it's likely a build.
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
       // This might be a local build or a non-vercel build.
       // However, Vercel build ALSO has NODE_ENV=production.
    }
    
    // A safer way is to just log and return empty string if it's missing during build
    // but we don't want to break production runtime.
    console.warn(`Warning: Missing environment variable: ${name}`);
    return "";
  }
  return v;
}

export function newLicenseId() {
  // Short, human-friendly ID. Adjust as needed.
  const rnd = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `LIC-${rnd}`;
}

export function nowISO() {
  return new Date().toISOString();
}
