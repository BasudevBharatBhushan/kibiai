"use client";

import { useCallback, useMemo, useState, useRef } from "react";
import { useReport } from "@/context/ReportContext";
import DynamicReport from "@/components/DynamicReportPreview";
import { ClassicReportView } from "@/components/report-viewer/ClassicReportView";
import type { DrillRequest, DrillResult } from "@/components/report-viewer/ClassicReportView";
import { buildReportMetadata, type ReportMetadata } from "@/lib/utils/reportMetadata";
import type { ClassicViewSettings } from "@/components/report-builder/ClassicViewSettingsSection";
import type { NestedReport } from "@/lib/sql/structureAdapter";
import type { DrilldownResult } from "@/lib/sql/structureAdapter";
import { LARGE_ROW_THRESHOLD } from "@/lib/sql/types";
import { apiClient } from "@/utils/apiClient";

// ---------------------------------------------------------------------------
// Shape of the SQL collapsed payload stored in state.reportPreview.
// The stream/generate route wraps report_structure_json + nested_report together
// when the SQL engine returns both.
// ---------------------------------------------------------------------------
interface SqlPreviewPayload {
  report_structure_json: unknown[];
  nested_report: NestedReport;
}

function isSqlPreviewPayload(raw: unknown): raw is SqlPreviewPayload {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    Array.isArray(r.report_structure_json) &&
    typeof r.nested_report === "object" &&
    r.nested_report !== null &&
    (r.nested_report as Record<string, unknown>).mode === "nested"
  );
}

// ---------------------------------------------------------------------------
// Response shape from POST /api/sql-report/generate (drilldown mode)
// ---------------------------------------------------------------------------
interface SqlDrilldownApiResponse {
  success: boolean;
  group_rows?: DrilldownResult;
  error?: string;
}

// ---------------------------------------------------------------------------
// Response shape from POST /api/sql-report/generate (expand_all / print mode)
// ---------------------------------------------------------------------------
interface SqlExpandApiResponse {
  success: boolean;
  nested?: NestedReport;
  report_structure_json?: unknown[];
  row_count?: number;
  warn_large?: boolean;
  error?: string;
}

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
  const rawData: unknown = state.reportPreview;

  const configToUse = state.lastGeneratedConfig || state.config;

  const derivedMetadata = useMemo<ReportMetadata | undefined>(() => {
    if (metadataProp) return metadataProp;
    if (!configToUse) return undefined;
    return buildReportMetadata(
      configToUse as unknown as Record<string, unknown>,
      (state.setup as unknown as Record<string, unknown>) ?? null
    );
  }, [metadataProp, configToUse, state.setup]);

  // ---------------------------------------------------------------------------
  // Nested SQL detection
  // ---------------------------------------------------------------------------
  const isNested = isSqlPreviewPayload(rawData);
  const reportMode: "flat" | "nested" = isNested ? "nested" : "flat";
  const nestedData: NestedReport | undefined = isNested
    ? (rawData as SqlPreviewPayload).nested_report
    : undefined;

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

  // ---------------------------------------------------------------------------
  // DATA NORMALIZATION
  // Nested mode: use report_structure_json from the wrapper as the FM scaffold.
  // Flat mode: same logic as before, unchanged.
  // ---------------------------------------------------------------------------
  let finalJsonData: unknown[] = [];

  try {
    if (isNested) {
      // SQL nested payload — use the FM-shaped scaffold that the engine also built.
      finalJsonData = (rawData as SqlPreviewPayload).report_structure_json;
    } else if (
      typeof rawData === "object" &&
      rawData !== null &&
      "report_structure_json" in rawData &&
      Array.isArray((rawData as Record<string, unknown>).report_structure_json)
    ) {
      finalJsonData = (rawData as Record<string, unknown>).report_structure_json as unknown[];
    } else if (Array.isArray(rawData)) {
      finalJsonData = rawData;
    } else if (
      typeof rawData === "object" &&
      rawData !== null &&
      "ReportStructuredData" in rawData
    ) {
      const rsd = (rawData as Record<string, unknown>).ReportStructuredData;
      const parsed = typeof rsd === "string" ? JSON.parse(rsd) : rsd;
      finalJsonData = Array.isArray(parsed) ? parsed : [];
    } else {
      console.warn("Unknown Preview Data Structure", rawData);
    }
  } catch (e) {
    console.error("Preview Data Error", e);
    return <div className="text-red-500 p-10">Error parsing report data.</div>;
  }

  // In nested mode, ClassicReportView renders from nestedData; finalJsonData provides
  // the FM scaffold (TitleHeader, Subsummary defs, etc.). We do NOT gate on
  // finalJsonData.length in nested mode because body rows are absent by design.
  if (!isNested && finalJsonData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 bg-white border border-slate-200 min-h-[600px]">
        No preview data available or data is empty.
      </div>
    );
  }

  // In nested mode with no groups, show empty state.
  if (isNested && (!nestedData || nestedData.groups.length === 0)) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 bg-white border border-slate-200 min-h-[600px]">
        No preview data available or data is empty.
      </div>
    );
  }

  const effectiveSettings: ClassicViewSettings = classicSettings ?? {
    showAvg: false,
    collapseBody: false,
    paginate: false,
  };

  const isPrint = viewMode === "print";

  return (
    <ReportPreviewInner
      finalJsonData={finalJsonData}
      reportMode={reportMode}
      nestedData={nestedData}
      effectiveSettings={effectiveSettings}
      derivedMetadata={derivedMetadata}
      activeFilters={activeFilters}
      isPrint={isPrint}
      isNested={isNested}
    />
  );
}

// ---------------------------------------------------------------------------
// Inner component — separated so hooks (useCallback) are always called
// unconditionally (no early returns before them).
// ---------------------------------------------------------------------------

interface InnerProps {
  finalJsonData: unknown[];
  reportMode: "flat" | "nested";
  nestedData: NestedReport | undefined;
  effectiveSettings: ClassicViewSettings;
  derivedMetadata: ReportMetadata | undefined;
  activeFilters: Record<string, string>;
  isPrint: boolean;
  isNested: boolean;
}

function ReportPreviewInner({
  finalJsonData,
  reportMode,
  nestedData,
  effectiveSettings,
  derivedMetadata,
  activeFilters,
  isPrint,
  isNested,
}: InnerProps) {
  const { state } = useReport();

  // ---------------------------------------------------------------------------
  // Expand-all state (nested SQL only).
  //
  // expandedNestedData: NestedReport with bodyRows populated on every leaf.
  //   null = not yet fetched; undefined = irrelevant (flat mode).
  // expandLoading: button disabled + spinner text while fetching.
  // expandError: last error message (cleared on next fetch attempt).
  //
  // The cache key tracks the config identity so a new report generation
  // invalidates the cached expanded data automatically.
  // ---------------------------------------------------------------------------
  const [expandedNestedData, setExpandedNestedData] = useState<NestedReport | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);
  // Tracks the config JSON at fetch time so config changes invalidate the cache.
  const expandCacheKeyRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // Print nested data state — separately cached from expand-all so switching
  // between classic-expanded and print-expanded doesn't cross-contaminate.
  // ---------------------------------------------------------------------------
  const [printNestedData, setPrintNestedData] = useState<NestedReport | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const printCacheKeyRef = useRef<string | null>(null);

  // Derive the config cache key (stable JSON so config changes bust the cache).
  const configCacheKey = useMemo(
    () => JSON.stringify(state.config),
    [state.config],
  );

  // Invalidate caches when config changes.
  if (expandCacheKeyRef.current !== null && expandCacheKeyRef.current !== configCacheKey) {
    expandCacheKeyRef.current = null;
    setExpandedNestedData(null);
    setExpandError(null);
  }
  if (printCacheKeyRef.current !== null && printCacheKeyRef.current !== configCacheKey) {
    printCacheKeyRef.current = null;
    setPrintNestedData(null);
  }

  // ---------------------------------------------------------------------------
  // fetchExpandAll — fetches expand_all from the SQL engine.
  // Handles the 30k warn→confirm flow.
  // Returns the NestedReport on success, null on cancel/error.
  // ---------------------------------------------------------------------------
  const fetchExpandAll = useCallback(
    async (viewMode: "expand_all" | "print", confirmLarge?: boolean): Promise<NestedReport | null> => {
      const body: Record<string, unknown> = {
        report_setup: state.setup,
        report_config: state.config,
        view_mode: viewMode,
        ...(confirmLarge ? { confirm_large: true } : {}),
      };

      const response = await apiClient.post<SqlExpandApiResponse>(
        "/api/sql-report/generate",
        body,
      );

      if (!response.success) {
        throw new Error(response.error ?? "Expand-all returned an error.");
      }

      if (response.warn_large) {
        const rowCount = response.row_count ?? 0;
        const proceed = window.confirm(
          `This report has ${rowCount.toLocaleString("en-US")} rows and may freeze the view. Load all anyway?`,
        );
        if (!proceed) return null;
        // Re-call with confirmLarge=true.
        return fetchExpandAll(viewMode, true);
      }

      if (!response.nested) {
        throw new Error("Expand-all response missing nested data.");
      }

      return response.nested;
    },
    [state.setup, state.config],
  );

  // ---------------------------------------------------------------------------
  // handleExpandAll — click handler for the "See all data" button.
  // ---------------------------------------------------------------------------
  const handleExpandAll = useCallback(async () => {
    // If already expanded, toggle back to collapsed.
    if (expandedNestedData !== null) {
      setExpandedNestedData(null);
      expandCacheKeyRef.current = null;
      return;
    }

    setExpandLoading(true);
    setExpandError(null);

    try {
      const nested = await fetchExpandAll("expand_all");
      if (nested) {
        setExpandedNestedData(nested);
        expandCacheKeyRef.current = configCacheKey;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load all data.";
      setExpandError(msg);
    } finally {
      setExpandLoading(false);
    }
  }, [expandedNestedData, fetchExpandAll, configCacheKey]);

  // ---------------------------------------------------------------------------
  // fetchPrintNestedData — fetches print/expand_all data lazily when entering
  // print mode for a nested SQL report (if not already cached).
  // ---------------------------------------------------------------------------
  const fetchPrintNestedData = useCallback(async () => {
    if (printCacheKeyRef.current === configCacheKey && printNestedData !== null) {
      // Already cached for current config — nothing to do.
      return;
    }

    // If we already fetched expand-all data, reuse it for print too.
    if (expandCacheKeyRef.current === configCacheKey && expandedNestedData !== null) {
      setPrintNestedData(expandedNestedData);
      printCacheKeyRef.current = configCacheKey;
      return;
    }

    setPrintLoading(true);

    try {
      const nested = await fetchExpandAll("print");
      if (nested) {
        setPrintNestedData(nested);
        printCacheKeyRef.current = configCacheKey;
      }
    } catch (err) {
      // Non-fatal: print will fall back to the flat scaffold.
      console.warn("[ReportPreview] Failed to fetch nested print data:", err);
    } finally {
      setPrintLoading(false);
    }
  }, [configCacheKey, printNestedData, expandedNestedData, fetchExpandAll]);

  // Trigger print data fetch when entering print mode for a nested SQL report.
  // Use a ref to avoid calling on every render in print mode.
  const printFetchTriggeredRef = useRef<string | null>(null);
  if (isNested && isPrint && printFetchTriggeredRef.current !== configCacheKey && !printLoading) {
    printFetchTriggeredRef.current = configCacheKey;
    void fetchPrintNestedData();
  }

  // The nested data to pass to ClassicReportView — prefer expanded if loaded.
  const activeNestedData =
    isNested && expandedNestedData !== null ? expandedNestedData : nestedData;

  // The nested data to pass to DynamicReport for print — prefer print-specific
  // data (bodyRows populated), then expand-all data, then collapsed (no body rows).
  const printNestedForDynamic =
    isNested && printNestedData !== null
      ? printNestedData
      : isNested && expandedNestedData !== null
        ? expandedNestedData
        : nestedData;

  // ---------------------------------------------------------------------------
  // handleDrillDown — async drill-down callback for ClassicReportView nested mode.
  //
  // ClassicReportView reconstructs groupPath as:
  //   groupId = "root|${node.label}:${labelStr}|..."
  // Each segment after "root" is split on the FIRST ":" giving:
  //   { field: node.label (the group field's human-readable label),
  //     label: labelStr   (String(node.value) — the actual group value) }
  //
  // We ZIP with Object.values(state.config.group_by_fields) (insertion-ordered,
  // same as REORDER_GROUPS preserves) to recover the logical table+field:
  //   groupPath[i].table = groups[i].table
  //   groupPath[i].field = groups[i].field
  //   groupPath[i].value = req.groupPath[i].label  ← this is the group VALUE
  // ---------------------------------------------------------------------------
  const handleDrillDown = useCallback(
    async (req: DrillRequest): Promise<DrillResult> => {
      const groups = Object.values(state.config.group_by_fields ?? {});

      // Build logical group_path by zipping req.groupPath with group_by_fields.
      // req.groupPath[i].label holds the group VALUE (String(node.value)) as
      // emitted by ClassicReportView's nestedRows walk:
      //   groupId = `${parentId}|${node.label}:${labelStr}`
      //   parsed back as { field: node.label, label: labelStr }
      const group_path = req.groupPath.map((seg, i) => {
        const g = groups[i];
        return {
          table: g?.table ?? "",
          field: g?.field ?? "",
          value: seg.label, // seg.label = labelStr = String(node.value)
        };
      });

      const body = {
        report_setup: state.setup,
        report_config: state.config,
        view_mode: "drilldown" as const,
        group_path,
        // ClassicReportView already confirmed large groups before calling us.
        // Pass confirm_large so the server returns rows instead of warn_large.
        ...(req.count > LARGE_ROW_THRESHOLD ? { confirm_large: true } : {}),
      };

      const response = await apiClient.post<SqlDrilldownApiResponse>(
        "/api/sql-report/generate",
        body
      );

      if (!response.success || !response.group_rows) {
        throw new Error(response.error ?? "Drill-down returned no data.");
      }

      return response.group_rows;
    },
    [state.config, state.setup]
  );

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/*
        Classic View — shown when viewMode === "classic"
      */}
      {!isPrint && (
        <div className="flex-1 overflow-auto p-4">
          {/* Expand-all control — nested SQL reports only. Lets the user load
              every body row (group→subgroup→rows) instead of the collapsed
              headers+totals view. fetchExpandAll handles the >30k warn→confirm. */}
          {isNested && (
            <div className="w-full flex items-center justify-end gap-3 mb-3">
              {expandError && (
                <span className="text-xs text-red-500">{expandError}</span>
              )}
              <button
                type="button"
                onClick={handleExpandAll}
                disabled={expandLoading}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {expandLoading
                  ? "Loading all data…"
                  : expandedNestedData !== null
                    ? "Collapse"
                    : "See all data"}
              </button>
            </div>
          )}
          <div className="w-full bg-white rounded-lg border border-slate-200 shadow-sm p-4">
            <ClassicReportView
              jsonData={finalJsonData as Record<string, unknown>[]}
              showAvg={effectiveSettings.showAvg}
              collapseBody={effectiveSettings.collapseBody}
              paginate={effectiveSettings.paginate}
              dateBreakdown={effectiveSettings.dateBreakdown}
              metadata={derivedMetadata}
              activeFilters={activeFilters}
              mode={reportMode}
              nestedData={activeNestedData}
              onDrillDown={handleDrillDown}
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

        Nested SQL print (Ticket 3): when entering print mode for a nested report,
        fetchPrintNestedData loads the expand-all nested tree (bodyRows populated)
        and we pass it as nestedData with mode="nested". Until it resolves we pass
        the collapsed nested tree (headers+totals); flat reports are unaffected.
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
        <DynamicReport
          jsonData={finalJsonData as Record<string, unknown>[]}
          metadata={derivedMetadata}
          mode={isNested ? "nested" : "flat"}
          nestedData={isNested ? printNestedForDynamic : undefined}
        />
      </div>
    </div>
  );
}
