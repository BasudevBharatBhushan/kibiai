import { NextResponse } from "next/server";
import { ReportConfig, ReportSetup } from "@/lib/reportConfigTypes";

// 1. Environment Variables (Server-side only)
const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;
const FM_SERVER = process.env.FM_HOST!;
const FM_DB = process.env.NEXT_PUBLIC_FM_DATABASE!;
const FM_LAYOUT = process.env.NEXT_PUBLIC_FM_LAYOUT!;
const FM_USER = process.env.FM_USERNAME!;
const FM_PASS = process.env.FM_PASSWORD!;

// Helper: Auth Headers
const getAuthHeaders = () => {
  const credentials = Buffer.from(`${FM_USER}:${FM_PASS}`).toString('base64');
  return {
    "Content-Type": "application/json",
    "Authorization": `Basic ${credentials}`
  };
};

// --- GET: Fetch Report by ID ---
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reportId = searchParams.get("id");

  if (!reportId) {
    return NextResponse.json({ error: "Missing Report ID" }, { status: 400 });
  }

  try {
    // 1. Construct FileMaker Query
    const body = {
      fmServer: FM_SERVER,
      method: "findRecord",
      methodBody: {
        database: FM_DB,
        layout: FM_LAYOUT,
        query: [{ "ReportID": `==${reportId}` }],
        limit: 1
      },
      session: { token: "", required: "" }
    };

    // 2. Call External API
    const response = await fetch(API_URL, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data?.records || !Array.isArray(data.records) || data.records.length === 0) {
      return NextResponse.json({ error: "Report not found in FM" }, { status: 404 });
    }

    // 3. Clean & Parse Data (Server-Side Logic)
    const record = data.records[0];


    
    // Handle fully qualified names or simple names
    const getField = (name: string) => record[`MultiTableReport::${name}`] || record[name];

    const configStr = getField("AIResponseJson");
    const setupStr = getField("SetupJson");
    const threadId = getField("OpenAI_AssistantThreadID");
    console.log('threadId', threadId)
    const config = configStr ? JSON.parse(configStr) : {};
    const setup = setupStr ? JSON.parse(setupStr) : null;

    // 4. Return CLEAN data to frontend
    return NextResponse.json({
      fmRecordId: record.recordId,
      config,
      setup,
      reportStructuredData: getField("ReportStructuredData"),
      threadId: threadId || null
    });

  } catch (error) {
    console.error("Fetch Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// --- POST: Update Report Configuration ---
export async function POST(request: Request) {
  try {
    const { fmRecordId, config, threadId, reportStructuredData } = await request.json();

    if (!fmRecordId) {
      return NextResponse.json({ error: "Missing Data" }, { status: 400 });
    }

    const payloadRecord: any = {};
    if (config !== undefined) {
      payloadRecord["MultiTableReport::AIResponseJson"] = JSON.stringify(config, null, 2);
    }
    if (threadId !== undefined) {
      payloadRecord["MultiTableReport::OpenAI_AssistantThreadID"] = threadId;
    }
    if (reportStructuredData !== undefined) {
      payloadRecord["MultiTableReport::ReportStructuredData"] = JSON.stringify(reportStructuredData);
    }

    // 1. Construct FileMaker Update
    const body = {
      fmServer: FM_SERVER,
      method: "updateRecord",
      methodBody: {
        database: FM_DB,
        layout: FM_LAYOUT,
        recordId: fmRecordId,
        record: payloadRecord
      },
      session: { token: "", required: "" }
    };

    // 2. Call External API
    const response = await fetch(API_URL, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error("Update Error:", error);
    return NextResponse.json({ error: "Update Failed" }, { status: 500 });
  }
}