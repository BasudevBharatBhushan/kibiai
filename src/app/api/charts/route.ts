import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'https://py-fmd.vercel.app/api/dataApi';

function getAuthHeader() {
  const username = process.env.FM_USERNAME || '';
  const password = process.env.FM_PASSWORD || '';
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

export async function POST(request: Request) {
  try {
    const { fmRecordId, isActive, chartType } = await request.json();

    if (!fmRecordId) {
      return NextResponse.json({ error: 'Missing Record ID' }, { status: 400 });
    }

    const fieldData: any = {};
    if (isActive !== undefined) {
      fieldData.isActive = isActive ? "1" : "0";
    }
    if (chartType !== undefined) {
      fieldData.ChartType = chartType; 
    }

    if (Object.keys(fieldData).length === 0) {
      return NextResponse.json({ message: 'No fields to update' });
    }

    const payload = {
      fmServer: process.env.FM_HOST,
      method: "updateRecord",
      methodBody: {
        database: process.env.FM_DATABASE,
        layout: process.env.FM_LAYOUT || "CHARTS_DAPI",
        recordId: fmRecordId,
        record: {
          "isActive": isActive ? "1" : "0",
          "ChartType": chartType
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

    const data = await res.json();
    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error("Internal API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}