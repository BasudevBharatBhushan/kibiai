import { ReportChartSchema } from '@/lib/ChartTypes';

const API_URL = process.env.API_URL || 'http://localhost:3001/api/dataApi';

interface ApiResponse {
  records: Array<{
    AI_JSONResponse_Chart: string;
    PrimaryKey: string;
    JS_ReportID: string;
  }>;
  messages?: Array<{ code: string; message: string }>;
}

interface ChartUpdateParams {
  isActive?: boolean;
  type?: string;
}

//Authentication
function getAuthHeader(){
    const username = process.env.FM_USERNAME || '';
    const password = process.env.FM_PASSWORD || '';
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

//Chart Configuration Fetcher
export async function fetchChartConfiguration(reportId: string): Promise<ReportChartSchema[]> {
  try {
    //Payload
    const payload = {
        fmServer : process.env.FM_HOST,
        method: "findRecord",
        methodBody: {
            database: process.env.FM_DATABASE,
            layout: process.env.FM_CHARTS_LAYOUT,
            query: [
                {
                    "JS_ReportID": `==${reportId}`
                }
            ],
            limit: 50
        },
        session: {
            token: "",
            required: ""
        }
    };

    //Send Post Request
    const res = await fetch (API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': getAuthHeader(), 
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
    });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to fetch report config: ${res.status} ${res.statusText} - ${errText}`);
    }

   const data: ApiResponse = await res.json();

    if (!data) {
        console.warn(`API returned null/empty response for report ${reportId}`);
        return [];
    }

    if (!data.records || !Array.isArray(data.records)) {
        if (data.messages && data.messages[0]?.code === '401') {
            console.log(`No charts found for Report ID ${reportId} (FM Error 401)`);
        } else {
            console.error("API Response missing 'records' array:", data);
        }
        return [];
    }
    const schemas: ReportChartSchema[] = data.records.map((record: any) => {
      try {
        if (!record.AI_JSONResponse_Chart) return null;
        
        const parsed = JSON.parse(record.AI_JSONResponse_Chart);
        return { 
          ...parsed, 
          pKey: record.PrimaryKey || parsed.pKey,
          isActive: record.isActive || parsed.isActive,
          fmRecordId: record.recordId || parsed.fmRecordId,
        };
      } catch (e) {
        console.error("Failed to parse chart config for record:", record.recordId, e);
        return null;
      }
    }).filter((item: any): item is ReportChartSchema => item !== null);

    return schemas;

  } catch (error) {
    console.error("API Fetch Error:", error);
    return [];
  }
}
//Update Chart Active Status
export async function updateChartStatus(fmRecordId: string, params: ChartUpdateParams): Promise<boolean> {
  if (!fmRecordId) return false;

  try {
    const res = await fetch('/api/charts/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fmRecordId, 
        isActive: params.isActive,
          chartType: params.type
        }),
    });

    if (!res.ok) {
        console.error("Failed to update status");
        return false;
    }

    return true;
  } catch (error) {
    console.error("Update Status Error:", error);
    return false;
  }
}

function normalizeRecord(record: any): any {
  const normalized: any = { ...record };

  const numFields = ['Profit', 'Quantity', 'Tax', 'Subtotal', 'Total Line', 'Line Price', 'Inventory', 'Unit Cost', 'Unit Price'];
  numFields.forEach(field => {
    if (record[field] !== undefined) {
      normalized[field] = parseFloat(record[field] || '0');
    }
  });

  if (record['Total Line'] !== undefined && record['Line Price'] === undefined) {
    normalized['Line Price'] = normalized['Total Line'];
  }
  if (record['Sales Date'] !== undefined && record['SalesDate'] === undefined) {
    normalized['SalesDate'] = record['Sales Date'];
  }
  if (record['SalesDate'] !== undefined && record['Sales Date'] === undefined) {
    normalized['Sales Date'] = record['SalesDate'];
  }

  return normalized;
}
//Report Data Fetcher
export async function fetchReportData(reportId: string): Promise<{ rows: any[], canvasState: any, layoutMode: string,reportRecordId: string }> {

  try {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': getAuthHeader() },
        body: JSON.stringify({
            fmServer: process.env.FM_HOST,
            method: "findRecord",
            methodBody: {
                database: process.env.FM_DATABASE,
                layout: "MultiTableReport Filtered Datas",
                query: [{ "ReportID": `==${reportId}` }],
                limit: 1 
            },
            session: { token: "", required: "" }
        }),
        cache: 'no-store',
    });

    if (!res.ok) throw new Error(`Data Fetch Failed: ${res.status}`);
    const data = await res.json();
    const record = data.records?.[0];

    if (!record || !record.ReportStructuredData) {
        console.warn("[API] No report data found.");
        return { rows: [], canvasState: [], layoutMode: 'grid', reportRecordId: "" };
    }

    const reportRecordId = record.recordId; 
    let canvasState: any[] = [];
    let layoutMode = 'grid';
    if (record.ChartCanvasState) {
        try {
            const parsed = JSON.parse(record.ChartCanvasState);
            
            if (Array.isArray(parsed)) {
                canvasState = parsed;
            } else if (parsed.charts && Array.isArray(parsed.charts)) {
                canvasState = parsed.charts;
                layoutMode = parsed.layoutMode || 'grid';
            }
        } catch (e) {
            console.warn("Could not parse saved ChartCanvasState", e);
        }
    }

    let rows: any[] = [];
    try {
        const parsedStructure = JSON.parse(record.ReportStructuredData);
        const bodyObj = parsedStructure.find((item: any) => item.Body && item.Body.BodyField);
        if (bodyObj && bodyObj.Body && Array.isArray(bodyObj.Body.BodyField)) {
            rows = bodyObj.Body.BodyField.map((row: any) => normalizeRecord(row));
        }
    } catch (e) {
        console.error("[API] Failed to parse ReportStructuredData", e);
    }

  return { rows, canvasState, layoutMode, reportRecordId };
  
  } catch (error) {
    console.error("[API] Critical Error:", error);
    return { rows: [], canvasState: null, layoutMode: 'grid', reportRecordId: "" };
  }
}

// Save State Function
export async function saveDashboardState(reportRecordId: string, newState: any): Promise<boolean> {
  if (!reportRecordId) {
    console.error("[API] Save aborted: Missing reportRecordId");
    return false;
  }

  try {
    const res = await fetch('/api/dashboard/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reportRecordId, 
          canvasState: newState 
        }),
    });

    if (!res.ok) {
        console.error(`[API] Save Failed: ${res.status} ${res.statusText}`);
        return false;
    }
    
    console.log("[API] Save Successful"); 
    return true;
  } catch (error) {
    console.error("[API] Save Error:", error);
    return false;
  }
}