import { NextResponse } from "next/server";

// ─── Environment ──────────────────────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;
const FM_SERVER = process.env.FM_HOST!;
const FM_DB = process.env.NEXT_PUBLIC_FM_DATABASE!;
const FM_REPORT_LAYOUT = process.env.NEXT_PUBLIC_FM_LAYOUT!;       // MultiTableReport layout
const FM_CHARTS_LAYOUT = "CHARTS_DAPI";                             // Charts layout
const FM_USER = process.env.FM_USERNAME!;
const FM_PASS = process.env.FM_PASSWORD!;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getAuthHeaders() {
  const credentials = Buffer.from(`${FM_USER}:${FM_PASS}`).toString("base64");
  return {
    "Content-Type": "application/json",
    Authorization: `Basic ${credentials}`,
  };
}

async function fmPost(body: unknown) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`FM API ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Extract all unique field-name keys from a ReportStructuredData JSON string.
 * The body data lives inside the object that has a "Body.BodyField" array.
 */
function extractFieldNames(rawStructuredData: string): string[] {
  try {
    const structure = JSON.parse(rawStructuredData);
    const bodySection = Array.isArray(structure)
      ? structure.find((x: any) => x?.Body?.BodyField)
      : null;

    const bodyFields: any[] = bodySection?.Body?.BodyField ?? [];
    if (!bodyFields.length) return [];

    // Union of all keys across every row
    const keySet = new Set<string>();
    bodyFields.forEach((row: any) => {
      if (row && typeof row === "object") {
        Object.keys(row).forEach((k) => keySet.add(k));
      }
    });

    return Array.from(keySet).filter(Boolean);
  } catch {
    return [];
  }
}

// ─── GET: Fetch chart copilot config for a report ─────────────────────────────
// GET /api/charts/chart-config?report_id=<id>
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reportId = searchParams.get("report_id");

  if (!reportId) {
    return NextResponse.json({ error: "Missing report_id" }, { status: 400 });
  }

  try {
    const body = {
      fmServer: FM_SERVER,
      method: "findRecord",
      methodBody: {
        database: FM_DB,
        layout: FM_REPORT_LAYOUT,
        query: [{ ReportID: `==${reportId}` }],
        limit: 1,
      },
      session: { token: "", required: "" },
    };

    const data = await fmPost(body);

    if (!data?.records?.length) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const record = data.records[0];
    console.log("[chart-config GET] Raw FM Record:", JSON.stringify(record, null, 2));

    // Support both fully-qualified and simple field names
    const getField = (name: string) =>
      record[`MultiTableReport::${name}`] ?? record[name] ?? null;

    const rawStructuredData = getField("ReportStructuredData") as string | null;
    const reportInsight = getField("ReportInsight") as string | null;
    const chartThreadId = getField("OpenAI_AssistantThreadID Report Analysis") as string | null;
    const reportRecordId = record.recordId as string | null;

    console.log("[chart-config GET] Extracted Values:", {
      reportRecordId,
      chartThreadId,
      reportInsight: reportInsight ? "exists" : "null",
      structuredData: rawStructuredData ? "exists" : "null"
    });

    const fieldNames = rawStructuredData
      ? extractFieldNames(rawStructuredData)
      : [];

    return NextResponse.json({
      reportRecordId: reportRecordId ?? null,
      fieldNames,
      reportInsight: reportInsight ?? null,
      chartThreadId: chartThreadId ?? null,
    });
  } catch (error) {
    console.error("[chart-config GET] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ─── POST: Persist chart thread ID and/or create new chart record ──────────────
// POST /api/charts/chart-config
// Body: { reportRecordId, chartThreadId?, chartRecord?: { reportId, aiJsonResponse } }
export async function POST(request: Request) {
  try {
    const { reportRecordId, chartThreadId, chartRecord } = await request.json();

    const results: Record<string, any> = {};

    // 1. Persist thread ID to the Report record
    if (chartThreadId !== undefined && reportRecordId) {
      const updateBody = {
        fmServer: FM_SERVER,
        method: "updateRecord",
        methodBody: {
          database: FM_DB,
          layout: FM_REPORT_LAYOUT,
          recordId: reportRecordId,
          record: {
            "MultiTableReport::OpenAI_AssistantThreadID Report Analysis": chartThreadId ?? "",
          },
        },
        session: { token: "", required: "" },
      };

      try {
        const updateResult = await fmPost(updateBody);
        results.threadUpdate = { ok: true, data: updateResult };
      } catch (e) {
        console.error("[chart-config POST] Thread ID update failed:", e);
        results.threadUpdate = { ok: false, error: String(e) };
      }
    }

    // 2. Create a new chart record in the Charts table
    if (chartRecord?.reportId && chartRecord?.aiJsonResponse) {
      const createBody = {
        fmServer: FM_SERVER,
        method: "createRecord",
        methodBody: {
          database: FM_DB,
          layout: FM_CHARTS_LAYOUT,
          record: {
            JS_ReportID: String(chartRecord.reportId),
            AI_JSONResponse_Chart: chartRecord.aiJsonResponse,
            isActive: "1",
          },
        },
        session: { token: "", required: "" },
      };

      try {
        const createResult = await fmPost(createBody);
        // Return the new record's FM record ID and primary key if available
        const newRecordId =
          createResult?.recordId ??
          createResult?.response?.recordId ??
          null;
        const newPKey =
          createResult?.PrimaryKey ??
          createResult?.response?.PrimaryKey ??
          null;

        results.chartCreate = { ok: true, recordId: newRecordId, pKey: newPKey };
      } catch (e) {
        console.error("[chart-config POST] Chart create failed:", e);
        results.chartCreate = { ok: false, error: String(e) };
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("[chart-config POST] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
