import { get, method } from 'lodash';
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
                    "JS_ReportID": `==${reportId}`,
                    "isActive": "1"
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
          pKey: record.PrimaryKey || parsed.pKey 
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
export async function fetchReportData(reportId: string): Promise<any[]> {
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
        console.warn(`No 'ReportStructuredData' found for Report ID ${reportId}`);
        return [];
    }

    let parsedStructure: any[] = [];
    try {
        parsedStructure = JSON.parse(record.ReportStructuredData);
        console.log("Parsed ReportStructuredData:", parsedStructure);
    } catch (e) {
        console.error("Failed to parse  JSON string", e);
        return [];
    }

    const bodyObj = parsedStructure.find((item: any) => item.Body && item.Body.BodyField);
    
    if (bodyObj && bodyObj.Body && Array.isArray(bodyObj.Body.BodyField)) {
        return bodyObj.Body.BodyField.map((row: any) => normalizeRecord(row));
    }

    return [];

  } catch (error) {
    console.error("API Data Error:", error);
    return [];
  }
}