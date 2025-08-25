import { NextRequest, NextResponse } from "next/server";
import {
  parseODataBatchResponse,
  flattenFileMakerRecords,
} from "@/app/utils/utility";

interface FetchFmDataRequest {
  raw_dataset: string;
  p_key_field: string;
  p_keys?: string[];
  filter?: Record<string, any>;
  table: string;
  host: string;
  database: string;
  version: string; // e.g., "vLatest" or "v2"
  data_fetching_protocol: "dataapi" | "odataapi" | "o-data-api" | "data-api"; // currently only dataapi
  session_token?: string;
}

export async function GET() {
  return NextResponse.json(
    { message: "FileMaker API endpoint is live" },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const {
      raw_dataset,
      p_key_field,
      p_keys,
      filter,
      table,
      host,
      database,
      version,
      data_fetching_protocol,
      session_token,
    }: FetchFmDataRequest = await req.json();

    // Extract Basic token from Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 400 }
      );
    }
    const basic_token = authHeader.replace("Basic ", "");

    /**
     * Helper: Convert filter operators from Data API style to OData style
     */
    function convertOperator(value: string, key: string) {
      if (value.includes("...")) {
        const [d1, d2] = value.split("...").map((v) => v.trim());
        return `ge '${d1}' and ${key} le '${d2}'`;
      }
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

    /**
     * ODATA API Flow
     */
    if (
      data_fetching_protocol === "odataapi" ||
      data_fetching_protocol === "o-data-api"
    ) {
      const batchBoundary = `b_${crypto.randomUUID()}`;
      let batchBody = "";

      if (p_keys && p_keys.length > 0) {
        if (!p_key_field) {
          return NextResponse.json(
            { error: "p_key_field is required when p_keys are provided" },
            { status: 400 }
          );
        }

        // Multiple GETs for OR operation
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
        // Single GET if no p_keys
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

      // console.log(batchBody);

      const odataRes = await fetch(odataUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic_token}`,
          "Content-Type": `multipart/mixed; boundary=${batchBoundary}`,
        },
        body: batchBody,
      });

      if (!odataRes.ok) {
        return NextResponse.json(
          { error: "Failed to fetch data via OData" },
          { status: odataRes.status }
        );
      }

      const odataData = await odataRes.text(); // raw batch response
      // console.log(batchBody);

      const parsedData = parseODataBatchResponse(odataData);
      return NextResponse.json({
        data: parsedData.records,
        recordCount: parsedData.recordCount,
      });
    }

    /**
     * DATA API Flow
     */
    if (
      data_fetching_protocol !== "dataapi" &&
      data_fetching_protocol !== "data-api"
    ) {
      return NextResponse.json(
        { error: "Unsupported protocol" },
        { status: 400 }
      );
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

      if (!loginRes.ok) {
        return NextResponse.json(
          { error: "Failed to authenticate with FileMaker Data API" },
          { status: 401 }
        );
      }

      const loginData = await loginRes.json();
      token = loginData.response.token;
    }

    // Step 3: Prepare find or get request
    let fetchUrl = `https://${host}/fmi/data/${version}/databases/${database}/layouts/${table}/records`;
    let method = "GET";
    let body: any = undefined;

    if (filter || (p_keys && p_keys.length > 0)) {
      fetchUrl = `https://${host}/fmi/data/${version}/databases/${database}/layouts/${table}/_find`;
      method = "POST";

      if (p_keys && p_keys.length > 0) {
        if (!p_key_field) {
          return NextResponse.json(
            { error: "p_key_field is required when p_keys are provided" },
            { status: 400 }
          );
        }
        const queries = p_keys.map((pk) => ({
          [p_key_field]: pk,
          ...(filter || {}),
        }));
        body = JSON.stringify({ query: queries });
      } else {
        body = JSON.stringify({ query: [filter || {}] });
      }
    }

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
      return NextResponse.json(
        { error: "Failed to fetch data from FileMaker" },
        { status: dataRes.status }
      );
    }

    const data = await dataRes.json();

    //Step 5: Extract the fieldData and put in a flat array of data:[{}, {}, ...]
    const FlattenedRecord = data.response
      ? flattenFileMakerRecords(data.response.data)
      : [];

    // Step 5: Return data + token
    return NextResponse.json({
      token,
      data: FlattenedRecord,
      recordCount: data.response?.dataInfo?.foundCount || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
