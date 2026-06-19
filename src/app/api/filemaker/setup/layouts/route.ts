import { NextRequest, NextResponse } from "next/server";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/**
 * POST /api/filemaker/setup/layouts
 *
 * Server-side proxy: fetches all layouts/tables from a FileMaker database
 * using the Data API. Credentials are forwarded via Authorization header —
 * they never touch the client-side bundle.
 *
 * Body: { host, database, protocol }
 * Auth: Basic base64(username:password)
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid Authorization header" },
        { status: 400 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { host, database, protocol } = body;

    if (!host || !database || !protocol) {
      return NextResponse.json(
        { success: false, error: "host, database, and protocol are required" },
        { status: 400 }
      );
    }

    if (protocol === "data-api") {
      return await fetchDataApiLayouts(host, database, authHeader);
    } else if (protocol === "o-data-api") {
      return await fetchODataMetadata(host, database, authHeader);
    } else {
      return NextResponse.json(
        { success: false, error: "Unsupported protocol. Use data-api or o-data-api." },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error("POST /api/filemaker/setup/layouts error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * Fetch layouts via FileMaker Data API
 * Returns flattened list: [{ name: string, table: string }]
 */
async function fetchDataApiLayouts(host: string, database: string, authHeader: string) {
  // Step 1: Authenticate to get a session token
  const loginUrl = `https://${host}/fmi/data/vLatest/databases/${encodeURIComponent(database)}/sessions`;
  const loginRes = await fetch(loginUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!loginRes.ok) {
    const loginErr = await loginRes.text();
    console.error("FileMaker login failed:", loginErr);
    return NextResponse.json(
      { success: false, error: "Failed to authenticate with FileMaker. Check credentials." },
      { status: 401 }
    );
  }

  const loginData = await loginRes.json();
  const token = loginData.response?.token;

  if (!token) {
    return NextResponse.json(
      { success: false, error: "No session token returned from FileMaker." },
      { status: 401 }
    );
  }

  // Step 2: Fetch layouts
  const layoutsUrl = `https://${host}/fmi/data/vLatest/databases/${encodeURIComponent(database)}/layouts`;
  const layoutsRes = await fetch(layoutsUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!layoutsRes.ok) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch layouts from FileMaker." },
      { status: layoutsRes.status }
    );
  }

  const layoutsData = await layoutsRes.json();
  const rawLayouts = layoutsData.response?.layouts || [];

  // Flatten: expand folder layouts (isFolder + folderLayoutNames)
  const layouts: { name: string; table: string }[] = rawLayouts.flatMap((layout: any) => {
    if (layout.isFolder && Array.isArray(layout.folderLayoutNames)) {
      return layout.folderLayoutNames.map((l: any) => ({
        name: l.name,
        table: l.table || l.name,
      }));
    }
    return [{ name: layout.name, table: layout.table || layout.name }];
  });

  // Logout to clean up session
  await fetch(
    `https://${host}/fmi/data/vLatest/databases/${encodeURIComponent(database)}/sessions/${token}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  ).catch(() => {});

  return NextResponse.json({ success: true, layouts, protocol: "data-api" });
}

/**
 * Fetch entity types via FileMaker OData API ($metadata)
 * Returns list: [{ table: string, fields: [{ name, type }] }]
 */
async function fetchODataMetadata(host: string, database: string, authHeader: string) {
  // Use v4 for OData as vLatest might fail on some configurations
  const metadataUrl = `https://${host}/fmi/odata/v4/${encodeURIComponent(database)}/$metadata`;

  const res = await fetch(metadataUrl, {
    method: "GET",
    headers: { Authorization: authHeader },
  });

  if (!res.ok) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch OData metadata. Check credentials and host." },
      { status: res.status }
    );
  }

  const xml = await res.text();
  
  // Simple regex-based XML parsing for EntityTypes and Properties
  // FileMaker OData EntityTypes usually look like <EntityType Name="TableName_">
  const tables: { table: string, fields: { name: string, type: string }[] }[] = [];
  
  const entityTypeRegex = /<EntityType\s+Name="([^"]+)"[^>]*>([\s\S]*?)<\/EntityType>/g;
  const propertyRegex = /<Property\s+Name="([^"]+)"\s+Type="([^"]+)"/g;
  
  let entityMatch;
  while ((entityMatch = entityTypeRegex.exec(xml)) !== null) {
    const rawName = entityMatch[1];
    const tableName = rawName.endsWith("_") ? rawName.slice(0, -1) : rawName;
    const entityContent = entityMatch[2];
    
    const fields: { name: string, type: string }[] = [];
    let propMatch;
    propertyRegex.lastIndex = 0; // Reset lastIndex for the new entityContent string
    while ((propMatch = propertyRegex.exec(entityContent)) !== null) {
      const fieldName = propMatch[1];
      const fieldType = propMatch[2];
      fields.push({
        name: fieldName,
        type: mapOdataType(fieldType),
      });
    }
    
    if (fields.length > 0) {
      tables.push({ table: tableName, fields });
    }
  }

  if (tables.length === 0) {
    return NextResponse.json(
      { success: false, error: "OData metadata returned no entity types." },
      { status: 422 }
    );
  }

  return NextResponse.json({ success: true, tables, protocol: "o-data-api" });
}

function mapOdataType(odataType: string | undefined): string {
  switch (odataType) {
    case "Edm.String":
      return "text";
    case "Edm.Decimal":
    case "Edm.Int32":
    case "Edm.Int64":
      return "number";
    case "Edm.Date":
    case "Edm.DateTimeOffset":
      return "date";
    default:
      return "text";
  }
}
