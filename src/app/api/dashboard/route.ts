import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'https://py-fmd.vercel.app/api/dataApi';

function getAuthHeader() {
  const username = process.env.FM_USERNAME || '';
  const password = process.env.FM_PASSWORD || '';
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

export async function POST(request: Request) {
  try {
    const { reportRecordId, canvasState } = await request.json();

    if (!reportRecordId) {
      return NextResponse.json({ error: 'Missing Report Record ID' }, { status: 400 });
    }

    const jsonString = JSON.stringify(canvasState);

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

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': getAuthHeader() 
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
    });

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