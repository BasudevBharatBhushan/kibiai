"use client";

import { useMemo } from "react";
import { useReport } from "@/context/ReportContext";
import DynamicReport from "@/components/DynamicReportPreview";
import { ClassicReportView } from "@/components/report-viewer/ClassicReportView";
import { buildReportMetadata, type ReportMetadata } from "@/lib/utils/reportMetadata";
import type { ClassicViewSettings } from "@/components/report-builder/ClassicViewSettingsSection";

interface ReportPreviewProps {
  /** Optional pre-built metadata. When omitted, metadata is derived from ReportContext. */
  metadata?: ReportMetadata;
  /** Classic view display settings driven from the ReportConfigurator panel */
  classicSettings?: ClassicViewSettings;
  /**
   * Active view mode — "classic" (default) or "print".
   * Controlled by the parent (ConfiguratorPageContent) so both
   * the configurator panel and the preview stay in sync.
   */
  viewMode?: "classic" | "print";
  /** Active filter state applied to the report data. */
  activeFilters?: Record<string, string>;
}

export function ReportPreview({
  metadata: metadataProp,
  classicSettings,
  viewMode = "classic",
  activeFilters = {},
}: ReportPreviewProps = {}) {
  const { state } = useReport();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawData: any = state.reportPreview;

  const configToUse = state.lastGeneratedConfig || state.config;

  const derivedMetadata = useMemo<ReportMetadata | undefined>(() => {
    if (metadataProp) return metadataProp;
    if (!configToUse) return undefined;
    return buildReportMetadata(
      configToUse as unknown as Record<string, unknown>,
      (state.setup as unknown as Record<string, unknown>) ?? null
    );
  }, [metadataProp, configToUse, state.setup]);

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

  // --- DATA NORMALIZATION ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalJsonData: any[] = [];

  try {
    if (rawData.report_structure_json && Array.isArray(rawData.report_structure_json)) {
      finalJsonData = rawData.report_structure_json;
    } else if (Array.isArray(rawData)) {
      finalJsonData = rawData;
    } else if (rawData.ReportStructuredData) {
      const parsed =
        typeof rawData.ReportStructuredData === "string"
          ? JSON.parse(rawData.ReportStructuredData)
          : rawData.ReportStructuredData;
      finalJsonData = Array.isArray(parsed) ? parsed : [];
    } else {
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
    );
  }

  const effectiveSettings: ClassicViewSettings = classicSettings ?? {
    showAvg: false,
    collapseBody: false,
  };

  const isPrint = viewMode === "print";

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/*
        Classic View — shown when viewMode === "classic"
      */}
      {!isPrint && (
        <div className="flex-1 overflow-auto p-4">
          <div className="w-full bg-white rounded-lg border border-slate-200 shadow-sm p-4">
            <ClassicReportView
              jsonData={finalJsonData}
              showAvg={effectiveSettings.showAvg}
              collapseBody={effectiveSettings.collapseBody}
              metadata={derivedMetadata}
              activeFilters={activeFilters}
            />
          </div>
        </div>
      )}

      {/*
        Print View — DynamicReport is ALWAYS kept mounted (even when in Classic mode)
        by placing it in an absolutely-positioned, off-screen container.
        This means pagination is calculated once on first load and cached in
        DynamicReport's own state. Switching to Print view is instant — no recalculation.
        
        We use position:absolute + visibility:hidden (NOT display:none) so that
        DynamicReport can still read element.offsetHeight during pagination.
      */}
      <div
        style={
          isPrint
            ? { flex: 1, overflow: "auto", padding: "16px" }
            : {
                position: "absolute",
                left: "-9999px",
                top: 0,
                width: "210mm",
                visibility: "hidden",
                pointerEvents: "none",
                zIndex: -1,
              }
        }
      >
        <DynamicReport jsonData={finalJsonData} metadata={derivedMetadata} />
      </div>
    </div>
  );
}