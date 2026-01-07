import { ReportChartSchema } from '@/lib/charts/ChartTypes';
import { FM_CONFIG } from '@/constants/filemaker';

// FileMaker Record Interface
interface FMRecord {
  recordId?: string;
  PrimaryKey?: string;
  AI_JSONResponse_Chart?: string;
  isActive?: boolean;
}

interface FMResponse<T = FMRecord> {
  records?: T[];
  messages?: { code: string; message: string }[];
}

interface ReportDataResult {
  rows: any[];
  canvasState: any[];
  layoutMode: 'grid' | 'free';
  reportRecordId: string;
}

// Config for FileMaker Data API
const API_URL = process.env.API_URL ?? FM_CONFIG.API_URL_DEFAULT;

// --- Helpers ---

// Basic Auth Header
function getAuthHeader(): string {
  const { FM_USERNAME, FM_PASSWORD } = process.env;

  if (!FM_USERNAME || !FM_PASSWORD) {
    throw new Error('Missing FileMaker credentials');
  }
  // Base64 Encode
  return `Basic ${Buffer.from(`${FM_USERNAME}:${FM_PASSWORD}`).toString('base64')}`;
}

// POST to FM Data API
async function fmPost<T>(payload: unknown): Promise<T> {
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
    throw new Error(`[FM API] ${res.status} ${await res.text()}`);
  }

  return res.json();
}

// --- Fetch Functions ---

// Fetch Chart Configurations
export async function fetchChartConfiguration(
  reportId: string
): Promise<ReportChartSchema[]> {
  const payload = {
    fmServer: process.env.FM_HOST,
    method: 'findRecord',
    methodBody: {
      database: process.env.FM_DATABASE,
      layout: process.env.FM_CHARTS_LAYOUT, 
      query: [{ JS_ReportID: `==${reportId}` }],
      limit: 50,
    },
    session: { token: '', required: '' },
  };

  try {
    const data = await fmPost<FMResponse>(payload);

    return (
      data.records
        ?.map(parseChartRecord)
        .filter(Boolean) as ReportChartSchema[]
    ) ?? [];
  } catch (error) {
    console.error('[Charts] fetch failed', error);
    return [];
  }
}

// Parse Chart Record
function parseChartRecord(record: FMRecord): ReportChartSchema | null {
  if (!record.AI_JSONResponse_Chart) return null;
  try {
    const parsed = JSON.parse(record.AI_JSONResponse_Chart);

    return {
      ...parsed,
      pKey: record.PrimaryKey ?? parsed.pKey,
      fmRecordId: record.recordId ?? parsed.fmRecordId,
      isActive: record.isActive ?? parsed.isActive,
    };
  } catch {
    return null;
  }
}

// Fetch Report Data
export async function fetchReportData(
  reportId: string
): Promise<ReportDataResult> {
  const payload = {
    fmServer: process.env.FM_HOST,
    method: 'findRecord',
    methodBody: {
      database: process.env.FM_DATABASE,
      layout: FM_CONFIG.LAYOUTS.REPORTS, 
      query: [{ ReportID: `==${reportId}` }],
      limit: 1,
    },
    session: { token: '', required: '' },
  };

  try {
    const data = await fmPost<any>(payload);
    const record = data.records?.[0];

    if (!record?.ReportStructuredData) {
      return emptyReport();
    }

    const rows = parseRows(record.ReportStructuredData);
    const { canvasState, layoutMode } = parseCanvas(
      record.ChartCanvasState
    );

    return {
      rows,
      canvasState,
      layoutMode,
      reportRecordId: record.recordId ?? '',
    };
  } catch (error) {
    console.error('[Report] fetch failed', error);
    return emptyReport();
  }
}

// --- Parsing Helpers ---

function parseCanvas(raw?: string) {
  if (!raw) return { canvasState: [], layoutMode: 'grid' };

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? { canvasState: parsed, layoutMode: 'grid' }
      : {
          canvasState: parsed.charts ?? [],
          layoutMode: parsed.layoutMode ?? 'grid',
        };
  } catch {
    return { canvasState: [], layoutMode: 'grid' };
  }
}

function parseRows(raw: string) {
  try {
    const structure = JSON.parse(raw);
    const body = structure.find((x: any) => x?.Body?.BodyField);
    return body?.Body?.BodyField ?? [];
  } catch {
    return [];
  }
}

function emptyReport(): ReportDataResult {
  return {
    rows: [],
    canvasState: [],
    layoutMode: 'grid',
    reportRecordId: '',
  };
}