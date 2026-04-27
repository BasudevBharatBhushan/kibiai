import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/filemaker/setup/fields
 *
 * Server-side proxy: fetches field metadata for a specific layout from
 * FileMaker Data API. Maps FM field types to our internal types.
 *
 * Body: { host, database, layout }
 * Auth: Basic base64(username:password)
 *
 * Returns: { fields: [{ name, type }] }
 * where type is: 'text' | 'number' | 'date'
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

    const { host, database, layout } = body;

    if (!host || !database || !layout) {
      return NextResponse.json(
        { success: false, error: "host, database, and layout are required" },
        { status: 400 }
      );
    }

    // Step 1: Authenticate with FileMaker Data API
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

    // Step 2: Fetch layout metadata (includes fieldMetaData)
    const layoutUrl = `https://${host}/fmi/data/vLatest/databases/${encodeURIComponent(database)}/layouts/${encodeURIComponent(layout)}`;
    const layoutRes = await fetch(layoutUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!layoutRes.ok) {
      // Logout before returning error
      await logoutSession(host, database, token);
      return NextResponse.json(
        { success: false, error: `Failed to fetch layout metadata for '${layout}'.` },
        { status: layoutRes.status }
      );
    }

    const layoutData = await layoutRes.json();
    const rawFields = layoutData.response?.fieldMetaData || layoutData.response?.metaData?.fieldMetaData || [];

    // Step 3: Map fields to our format
    const fields: { name: string; type: string }[] = rawFields.map((field: any) => ({
      name: field.name,
      type: mapFieldType(field.result),
    }));

    // Step 4: Logout
    await logoutSession(host, database, token);

    return NextResponse.json({ success: true, fields });
  } catch (err: any) {
    console.error("POST /api/filemaker/setup/fields error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

/** Map FileMaker field result type to our internal type */
function mapFieldType(fmResult: string | undefined): "text" | "number" | "date" {
  switch (fmResult) {
    case "number":
      return "number";
    case "date":
    case "timestamp":
      return "date";
    default:
      return "text";
  }
}

/** Clean up FileMaker session */
async function logoutSession(host: string, database: string, token: string) {
  try {
    await fetch(
      `https://${host}/fmi/data/vLatest/databases/${encodeURIComponent(database)}/sessions/${token}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
  } catch {
    // Non-critical — session will expire on its own
  }
}
