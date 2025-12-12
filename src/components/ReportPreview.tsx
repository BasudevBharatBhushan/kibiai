"use client";

import { useReport } from "@/context/ReportContext";
import DynamicReport from "@/components/DynamicReportPreview"; 

export function ReportPreview() {
  const { state } = useReport();
  const rawData = state.reportPreview;

  if (!rawData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-white shadow-sm border border-slate-200 min-h-[600px] rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
        <p>Loading Report Preview...</p>
      </div>
    );
  }

  // --- DATA NORMALIZATION LOGIC ---
  let finalJsonData: any[] = [];

  try {
    // Case 1: LIVE UPDATE (from /api/trigger-generation)
    // The API returns { status: "ok", report_structure_json: [...] }
    if (rawData.report_structure_json && Array.isArray(rawData.report_structure_json)) {
      finalJsonData = rawData.report_structure_json;
    } 
    // Case 2: INITIAL LOAD (from DB via /api/reportConfig)
    // The DB returns { config: ..., setup: ..., fmRecordId: ... }
    // BUT we need the `ReportStructuredData` field which might be inside the raw response
    // NOTE: The `state.reportPreview` is set by `fetchPreview` in page.tsx. 
    // Let's ensure page.tsx passes the correct data.
    
    // Fallback: If passed directly as array
    else if (Array.isArray(rawData)) {
      finalJsonData = rawData;
    }
    else {
      console.warn("Unknown Preview Data Structure", rawData);
    }

  } catch (e) {
    console.error("Preview Data Error", e);
    return <div className="text-red-500 p-10">Error parsing report data.</div>;
  }

  if (finalJsonData.length === 0) {
     return (
        <div className="flex items-center justify-center h-full text-slate-400 bg-white border border-slate-200 min-h-[600px]">
           No preview data available.
        </div>
     )
  }

  return (
    <div className="bg-white shadow-lg border border-slate-200 w-full min-h-[800px] p-8 overflow-auto">
      {/* Pass the normalized array to the engine */}
      <DynamicReport jsonData={finalJsonData} />
    </div>
  );
}