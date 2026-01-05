import { NextResponse } from 'next/server';
import { FM_CONFIG } from '@/lib/constants/filemaker'; 

// Configuration
const API_URL = process.env.API_URL || FM_CONFIG.API_URL_DEFAULT;

interface SaveRequest {
  reportRecordId: string;
  canvasState: any[]; 
  layoutMode?: string; 
}

function getAuthHeader() {
  const username = process.env.FM_USERNAME || '';
  const password = process.env.FM_PASSWORD || '';
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

export async function POST(request: Request) {
  try {
    // 1. Parse and Typed Request
    const body = (await request.json()) as SaveRequest;
    const { reportRecordId, canvasState } = body;

    // 2. Validate
    if (!reportRecordId) {
      return NextResponse.json({ error: 'Missing Report Record ID' }, { status: 400 });
    }

    // 3. Serialize Data
    const jsonString = JSON.stringify(canvasState);

    // 4. Construct Payload
    const payload = {
      fmServer: process.env.FM_HOST,
      method: "updateRecord",
      methodBody: {
        database: process.env.FM_DATABASE,
        layout: FM_CONFIG.LAYOUTS.REPORTS, 
        
        recordId: reportRecordId, 
        record: {
          "ChartCanvasState": jsonString
        }
      },
      session: { token: "", required: "" }
    };

    // 5. Send to Middleware
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': getAuthHeader() 
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
    });

    // 6. Handle Response
    if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ error: errText }, { status: res.status });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[Dashboard Save] Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}