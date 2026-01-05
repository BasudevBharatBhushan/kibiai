import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'https://py-fmd.vercel.app/api/dataApi';

//Generates the Basic Auth header
function getAuthHeader() {
  const username = process.env.FM_USERNAME || '';
  const password = process.env.FM_PASSWORD || '';
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

export async function POST(request: Request) {
  try {
    // 1. Parse the request body
    const { reportRecordId, canvasState } = await request.json();

    // 2. Validate essential keys
    if (!reportRecordId) {
      return NextResponse.json({ error: 'Missing Report Record ID' }, { status: 400 });
    }

    // 3. Serialize the Canvas State
    const jsonString = JSON.stringify(canvasState);

    // 4. Construct the Payload
    const payload = {
      fmServer: process.env.FM_HOST,
      method: "updateRecord",
      methodBody: {
        database: process.env.FM_DATABASE,
        layout: "MultiTableReport Filtered Datas", 
        recordId: reportRecordId, 
        record: {
          "ChartCanvasState": jsonString
        }
      },
      session: { token: "", required: "" }
    };

    // 5. Send to External API
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': getAuthHeader() 
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
    });

    // 6. Handle the Response
    if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ error: errText }, { status: res.status });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Save API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}