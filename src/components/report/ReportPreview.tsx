"use client";

import { useReport } from "@/context/ReportContext";
import DynamicReport from "@/components/report/DynamicReportPreview"; 

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
    // 1. Live API response: { status: "ok", report_structure_json: [...] }
    if (rawData.report_structure_json && Array.isArray(rawData.report_structure_json)) {
      finalJsonData = rawData.report_structure_json;
    } 
    // 2. Direct Array (Already parsed from DB string)
    else if (Array.isArray(rawData)) {
      finalJsonData = rawData;
    }
    // 3. Fallback: Try to find ReportStructuredData if passed as raw object
    else if (rawData.ReportStructuredData) {
       const parsed = typeof rawData.ReportStructuredData === 'string' 
          ? JSON.parse(rawData.ReportStructuredData)
          : rawData.ReportStructuredData;
       finalJsonData = Array.isArray(parsed) ? parsed : [];
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
           No preview data available or data is empty.
        </div>
     )
  }

  // Render the DynamicReport with the normalized array
  return (
    <div className="w-full h-full p-4 overflow-auto">
      <DynamicReport jsonData={finalJsonData} />
    </div>
  );
}