import { NextResponse } from 'next/server';

//Config for FileMaker Data API
const API_URL =
  process.env.API_URL ?? 'https://py-fmd.vercel.app/api/dataApi';

interface UpdateRequest {
  fmRecordId: string;
  isActive?: boolean;
  chartType?: string;
}

//Basic Auth Header
function getAuthHeader() {
  const { FM_USERNAME, FM_PASSWORD } = process.env;

  if (!FM_USERNAME || !FM_PASSWORD) {
    throw new Error('Missing FM credentials');
  }

  //Base64 Encode
  return `Basic ${Buffer.from(
    `${FM_USERNAME}:${FM_PASSWORD}`
  ).toString('base64')}`;
}

export async function POST(req: Request) {
  try {
    // 1. Parse incoming request body
    const body = (await req.json()) as UpdateRequest;
    const { fmRecordId, isActive, chartType } = body;

    // 2. Validate required fields
    if (!fmRecordId) {
      return NextResponse.json(
        { error: 'fmRecordId required' },
        { status: 400 }
      );
    }

    const record: Record<string, string> = {};

    if (typeof isActive === 'boolean') {
      record.isActive = isActive ? '1' : '0';
    }

    if (typeof chartType === 'string' && chartType.trim()) {
      record.ChartType = chartType;
    }

    if (!Object.keys(record).length) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // 3. Prepare payload for FM Data API
    const payload = {
      fmServer: process.env.FM_HOST,
      method: 'updateRecord',
      methodBody: {
        database: process.env.FM_DATABASE,
        layout: process.env.FM_LAYOUT ?? 'CHARTS_DAPI',
        recordId: fmRecordId,
        record,
      },
      session: { token: '', required: '' },
    };

    // 4. Make request to FM Data API
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    // 5. Handle response
    if (!res.ok) {
      return NextResponse.json(
        { error: await res.text() },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Charts Route] error', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
