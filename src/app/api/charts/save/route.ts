import { NextResponse } from 'next/server';
import { FM_CONFIG } from '@/lib/constants/filemaker';
import { ChartKind } from '@/lib/charts/ChartTypes'; 

// Configuration
const API_URL = process.env.API_URL ?? FM_CONFIG.API_URL_DEFAULT;

//Type for Incoming Request Body
interface UpdateRequest {
  fmRecordId: string;
  isActive?: boolean;     
  chartType?: ChartKind;  
}

function getAuthHeader() {
  const { FM_USERNAME, FM_PASSWORD } = process.env;
  if (!FM_USERNAME || !FM_PASSWORD) throw new Error('Missing FM credentials');
  return `Basic ${Buffer.from(`${FM_USERNAME}:${FM_PASSWORD}`).toString('base64')}`;
}

export async function POST(req: Request) {
  try {
    // 1. Parse and Cast Request Body
    const body = (await req.json()) as UpdateRequest;
    const { fmRecordId, isActive, chartType } = body;

    // 2. Validate
    if (!fmRecordId) {
      return NextResponse.json({ error: 'fmRecordId required' }, { status: 400 });
    }

    // 3. Prepare Update Payload
    const record: Record<string, string> = {};

    if (typeof isActive === 'boolean') {
      record.isActive = isActive ? FM_CONFIG.BOOL.TRUE : FM_CONFIG.BOOL.FALSE;
    }

    if (chartType) {
      record.ChartType = chartType; 
    }

    if (!Object.keys(record).length) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // 4. Construct Middleware Payload
    const payload = {
      fmServer: process.env.FM_HOST,
      method: 'updateRecord',
      methodBody: {
        database: process.env.FM_DATABASE,
        layout: process.env.FM_LAYOUT ?? FM_CONFIG.LAYOUTS.CHARTS_DEFAULT,
        recordId: fmRecordId,
        record,
      },
      session: { token: '', required: '' },
    };

    // 5. Execute Request
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
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