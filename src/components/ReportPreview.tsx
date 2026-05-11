"use client";

import { useMemo } from "react";
import { useReport } from "@/context/ReportContext";
import DynamicReport from "@/components/DynamicReportPreview";
import { buildReportMetadata, type ReportMetadata } from "@/lib/utils/reportMetadata";

interface ReportPreviewProps {
  /** Optional pre-built metadata. When omitted, metadata is derived from ReportContext. */
  metadata?: ReportMetadata;
}

export function ReportPreview({ metadata: metadataProp }: ReportPreviewProps = {}) {
  const { state } = useReport();
  const rawData = state.reportPreview;

  // Fallback: derive metadata from the current config in ReportContext so
  // admin previews stay in sync with date_range_fields / filters edits.
  const derivedMetadata = useMemo<ReportMetadata | undefined>(() => {
    if (metadataProp) return metadataProp;
    if (!state.config) return undefined;
    return buildReportMetadata(
      state.config as unknown as Record<string, unknown>,
      (state.setup as unknown as Record<string, unknown>) ?? null
    );
  }, [metadataProp, state.config, state.setup]);

  if (!rawData) {
    return (
      <div className="w-full flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm min-h-[600px] gap-4 p-10">
        <div className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-slate-700 font-semibold text-base">No report preview yet</p>
          <p className="text-slate-400 text-sm mt-1 max-w-xs">Ask the AI Copilot to generate a report, or use the configurator panel to set up your report structure manually.</p>
        </div>
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
      <DynamicReport jsonData={finalJsonData} metadata={derivedMetadata} />
    </div>
  );
}