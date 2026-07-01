"use client";

import { useCallback, useMemo, useState, useRef, startTransition } from "react";
import { useReport } from "@/context/ReportContext";
import { useHeader } from "@/context/HeaderContext";
import DynamicReport from "@/components/DynamicReportPreview";
import { ClassicReportView } from "@/components/report-viewer/ClassicReportView";
import type { DrillRequest, DrillResult } from "@/components/report-viewer/ClassicReportView";
import { buildReportMetadata, type ReportMetadata } from "@/lib/utils/reportMetadata";
import type { ClassicViewSettings } from "@/components/report-builder/ClassicViewSettingsSection";
import type { NestedReport, NestedGroupNode } from "@/lib/sql/structureAdapter";
import type { DrilldownResult } from "@/lib/sql/structureAdapter";
import { LARGE_ROW_THRESHOLD } from "@/lib/sql/types";
import { apiClient } from "@/utils/apiClient";
import { SqlExecutionFloater, type SqlStep } from "@/components/SqlExecutionFloater";

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
  sql_steps?: SqlStep[];
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
  sql_steps?: SqlStep[];
  error?: string;
}

// ---------------------------------------------------------------------------
// FlatRowTable — renders a plain scrollable table for no-group expand_all results.
// Caps display pool at FLAT_ROW_DISPLAY_LIMIT rows; paginates within that pool
// when paginate=true.
// ---------------------------------------------------------------------------
// Matches the DB-level LARGE_ROW_THRESHOLD — all fetched rows go into the pool.
// Pagination (100 rows/page) keeps rendering fast even at this size.
const FLAT_ROW_DISPLAY_LIMIT = 30_000;
const FLAT_PAGE_SIZE = 100;

function FlatRowTable({
  rows,
  fieldOrder,
  totalRowCount,
  paginate = false,
  title,
}: {
  rows: Record<string, unknown>[];
  fieldOrder: string[];
  totalRowCount?: number;
  paginate?: boolean;
  title?: string;
}) {
  const [page, setPage] = useState(0);

  const columns = fieldOrder.length > 0 ? fieldOrder : Object.keys(rows[0] ?? {});
  // The pool is capped at FLAT_ROW_DISPLAY_LIMIT for browser performance.
  const pool = rows.slice(0, FLAT_ROW_DISPLAY_LIMIT);
  // dbTotal is the real count from the DB COUNT query (before any LIMIT).
  const dbTotal = totalRowCount ?? rows.length;
  // Any rows beyond the pool are truncated server-side or display-side.
  const anyCapped = dbTotal > pool.length;

  const totalPages = paginate ? Math.max(1, Math.ceil(pool.length / FLAT_PAGE_SIZE)) : 1;
  // Reset to page 0 if pool changes (new report generated).
  const safePageIndex = Math.min(page, totalPages - 1);
  const pageRows = paginate
    ? pool.slice(safePageIndex * FLAT_PAGE_SIZE, (safePageIndex + 1) * FLAT_PAGE_SIZE)
    : pool;

  const rowStart = paginate ? safePageIndex * FLAT_PAGE_SIZE + 1 : 1;
  const rowEnd = paginate ? Math.min((safePageIndex + 1) * FLAT_PAGE_SIZE, pool.length) : pool.length;

  const countLabel = anyCapped
    ? `Showing ${pool.length.toLocaleString()} of ${dbTotal.toLocaleString()} total rows`
    : `${pool.length.toLocaleString()} rows`;

  return (
    <div className="w-full bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden min-h-[600px] flex flex-col">
      {/* Header bar — all info + pagination + export icon */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center gap-3 shrink-0">
        {/* Left: record counts */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-semibold text-slate-700">
            {title ? `${title} · ` : ""}{dbTotal.toLocaleString()} records
          </span>
          {anyCapped && (
            <span className="text-[10px] text-amber-600 font-medium mt-0.5">
              Only {pool.length.toLocaleString()} loaded for preview — export Excel for the full dataset
            </span>
          )}
        </div>

        {/* Center: pagination controls */}
        {paginate && totalPages > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePageIndex === 0}
              className="px-2 py-1 text-xs rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ‹ Prev
            </button>
            <span className="text-xs text-slate-600 font-medium tabular-nums px-1">
              {safePageIndex + 1} / {totalPages}
              <span className="text-slate-400 font-normal ml-1">({rowStart.toLocaleString()}–{rowEnd.toLocaleString()})</span>
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePageIndex === totalPages - 1}
              className="px-2 py-1 text-xs rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next ›
            </button>
          </div>
        )}

        {/* Right: export icon button */}
        {anyCapped && (
          <button
            type="button"
            disabled
            title="Export full data to Excel (coming soon)"
            className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 hover:bg-slate-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        )}
      </div>

      {/* Scrollable table */}
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="bg-slate-800 text-slate-50 px-3 py-2 text-left font-semibold border border-slate-700 whitespace-nowrap text-xs"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr
                key={i}
                className={(safePageIndex * FLAT_PAGE_SIZE + i) % 2 === 0 ? "bg-white" : "bg-slate-50"}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-2 border border-slate-200 text-slate-700 text-xs break-words"
                    title={String(row[col] ?? "")}
                  >
                    {String(row[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
  const { subtitle: templateName } = useHeader();
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

  // In nested mode with no groups, show flat table when rows exist, else empty state.
  if (isNested && (!nestedData || nestedData.groups.length === 0)) {
    const flatRows = nestedData?.flatRows;
    if (flatRows && flatRows.length > 0) {
      const reportHeader = configToUse?.report_header;
      return <FlatRowTable rows={flatRows} fieldOrder={nestedData?.fieldOrder ?? []} totalRowCount={nestedData?.totalRowCount} paginate={classicSettings?.paginate ?? false} title={reportHeader || nestedData?.title || templateName || undefined} />;
    }
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
      setup={state.setup}
      config={state.config}
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
  setup: unknown;
  config: unknown;
}

const LOAD_MORE_PAGE_SIZE = 1000;

function ReportPreviewInner({
  finalJsonData,
  reportMode,
  nestedData,
  effectiveSettings,
  derivedMetadata,
  activeFilters,
  isPrint,
  isNested,
  setup,
  config,
}: InnerProps) {
  const { state } = useReport();

  // ---------------------------------------------------------------------------
  // Load-more state — appends additional group pages to the nested view.
  // ---------------------------------------------------------------------------
  const [additionalGroups, setAdditionalGroups] = useState<NestedGroupNode[]>([]);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  // Merge base groups + any additionally loaded groups for the active view.
  const mergedNestedData = useMemo<NestedReport | undefined>(() => {
    if (!nestedData) return undefined;
    if (additionalGroups.length === 0) return nestedData;
    return { ...nestedData, groups: [...nestedData.groups, ...additionalGroups] };
  }, [nestedData, additionalGroups]);

  // Reset additional groups when the base nestedData changes (new report generated).
  const nestedDataRef = useRef<NestedReport | undefined>(undefined);
  if (nestedDataRef.current !== nestedData) {
    nestedDataRef.current = nestedData;
    if (additionalGroups.length > 0) setAdditionalGroups([]);
    if (loadMoreError !== null) setLoadMoreError(null);
  }

  const handleLoadMore = useCallback(async () => {
    if (!nestedData || loadMoreLoading) return;
    const currentOffset = nestedData.groups.length + additionalGroups.length;
    setLoadMoreLoading(true);
    setLoadMoreError(null);
    setIsDrillFetching(true);
    try {
      const response = await apiClient.post<SqlExpandApiResponse>("/api/sql-report/generate", {
        report_setup: setup,
        report_config: config,
        view_mode: "collapsed",
        group_offset: currentOffset,
        group_limit: LOAD_MORE_PAGE_SIZE,
      });
      for (const step of response.sql_steps ?? []) {
        setDrillSqlStep(step);
        await new Promise<void>((r) => setTimeout(r, 180));
      }
      if (!response.success || !response.nested) {
        throw new Error(response.error ?? "Load more returned no data.");
      }
      startTransition(() => {
        setAdditionalGroups((prev) => [...prev, ...response.nested!.groups]);
      });
    } catch (err) {
      setLoadMoreError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadMoreLoading(false);
      setIsDrillFetching(false);
    }
  }, [nestedData, additionalGroups, loadMoreLoading, setup, config]);

  // Derive the config cache key (stable JSON so config changes bust the cache).
  const configCacheKey = useMemo(
    () => JSON.stringify(state.config),
    [state.config],
  );

  // ---------------------------------------------------------------------------
  // Shared helper: fetch expand_all or print data from the SQL engine.
  // Returns { nested } on success, { warnLarge, rowCount } when rows > 30k,
  // or throws on error.
  // ---------------------------------------------------------------------------
  const fetchExpandData = useCallback(
    async (
      viewMode: "expand_all" | "print",
      confirmLarge = false,
    ): Promise<{ nested?: NestedReport; warnLarge?: boolean; rowCount?: number }> => {
      setIsDrillFetching(true);
      try {
        const response = await apiClient.post<SqlExpandApiResponse>(
          "/api/sql-report/generate",
          {
            report_setup: setup,
            report_config: config,
            view_mode: viewMode,
            ...(confirmLarge ? { confirm_large: true } : {}),
          },
        );
        for (const step of response.sql_steps ?? []) {
          setDrillSqlStep(step);
          await new Promise<void>((r) => setTimeout(r, 180));
        }
        if (!response.success) throw new Error(response.error ?? "Engine error");
        if (response.warn_large) return { warnLarge: true, rowCount: response.row_count };
        if (response.nested) return { nested: response.nested };
        throw new Error("Engine returned no data");
      } finally {
        setIsDrillFetching(false);
      }
    },
    [setup, config],
  );

  // ---------------------------------------------------------------------------
  // Print nested data state — lazily fetches full expand data for print view.
  // ---------------------------------------------------------------------------
  const [printNestedData, setPrintNestedData] = useState<NestedReport | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [printWarnLarge, setPrintWarnLarge] = useState<{ rowCount: number } | null>(null);
  const printCacheKeyRef = useRef<string | null>(null);
  const printFetchTriggeredRef = useRef<string | null>(null);

  // Invalidate print cache when config changes.
  if (printCacheKeyRef.current !== null && printCacheKeyRef.current !== configCacheKey) {
    printCacheKeyRef.current = null;
    setPrintNestedData(null);
    setPrintWarnLarge(null);
  }

  const fetchPrintNestedData = useCallback(async (confirmLarge = false) => {
    if (!confirmLarge && printCacheKeyRef.current === configCacheKey && printNestedData !== null) return;
    setPrintLoading(true);
    setPrintWarnLarge(null);
    try {
      const result = await fetchExpandData("print", confirmLarge);
      if (result.warnLarge) {
        setPrintWarnLarge({ rowCount: result.rowCount ?? 0 });
      } else if (result.nested) {
        setPrintNestedData(result.nested);
        printCacheKeyRef.current = configCacheKey;
      }
    } catch (err) {
      console.warn("[ReportPreview] Failed to fetch print data:", err);
    } finally {
      setPrintLoading(false);
    }
  }, [configCacheKey, printNestedData, fetchExpandData]);

  // Trigger print fetch when entering print mode.
  if (isNested && isPrint && printFetchTriggeredRef.current !== configCacheKey && !printLoading) {
    printFetchTriggeredRef.current = configCacheKey;
    void fetchPrintNestedData();
  }

  // ---------------------------------------------------------------------------
  // Drilldown SQL floater state
  const [drillSqlStep, setDrillSqlStep] = useState<SqlStep | null>(null);
  const [isDrillFetching, setIsDrillFetching] = useState(false);

  // Expand-all state — fetches full body rows for classic view when
  // collapseBody is false. Mirrors print flow but uses "expand_all" mode.
  // ---------------------------------------------------------------------------
  const [expandedNestedData, setExpandedNestedData] = useState<NestedReport | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  const [expandWarnLarge, setExpandWarnLarge] = useState<{ rowCount: number } | null>(null);
  const expandCacheKeyRef = useRef<string | null>(null);
  const expandFetchTriggeredRef = useRef<string | null>(null);

  const wantsExpand = isNested && !effectiveSettings.collapseBody;

  // Invalidate expand cache when config changes.
  if (expandCacheKeyRef.current !== null && expandCacheKeyRef.current !== configCacheKey) {
    expandCacheKeyRef.current = null;
    setExpandedNestedData(null);
    setExpandWarnLarge(null);
  }

  const fetchExpandAll = useCallback(async (confirmLarge = false) => {
    if (!confirmLarge && expandCacheKeyRef.current === configCacheKey && expandedNestedData !== null) return;
    setExpandLoading(true);
    setExpandWarnLarge(null);
    try {
      const result = await fetchExpandData("expand_all", confirmLarge);
      if (result.warnLarge) {
        setExpandWarnLarge({ rowCount: result.rowCount ?? 0 });
      } else if (result.nested) {
        setExpandedNestedData(result.nested);
        expandCacheKeyRef.current = configCacheKey;
      }
    } catch (err) {
      console.warn("[ReportPreview] Failed to fetch expand-all data:", err);
    } finally {
      setExpandLoading(false);
    }
  }, [configCacheKey, expandedNestedData, fetchExpandData]);

  // Trigger expand-all fetch when collapseBody is turned off.
  if (wantsExpand && expandFetchTriggeredRef.current !== configCacheKey && !expandLoading) {
    expandFetchTriggeredRef.current = configCacheKey;
    void fetchExpandAll();
  }
  // Reset trigger when collapseBody is turned back on.
  if (!wantsExpand && expandFetchTriggeredRef.current !== null) {
    expandFetchTriggeredRef.current = null;
  }

  // Classic view uses merged (base + load-more) nested data, or fully expanded data.
  const activeNestedData = wantsExpand && expandedNestedData !== null
    ? expandedNestedData
    : mergedNestedData;

  // Print view uses the lazily-fetched print data with bodyRows populated.
  const printNestedForDynamic =
    isNested && printNestedData !== null
      ? printNestedData
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

      setIsDrillFetching(true);

      let response: SqlDrilldownApiResponse;
      try {
        response = await apiClient.post<SqlDrilldownApiResponse>(
          "/api/sql-report/generate",
          body
        );
      } catch (err) {
        setIsDrillFetching(false);
        throw err;
      }

      // Replay sql_steps sequentially with brief delays so the floater shows
      // each query that ran (non-streaming, so we animate after the response).
      for (const step of response.sql_steps ?? []) {
        setDrillSqlStep(step);
        await new Promise<void>((r) => setTimeout(r, 180));
      }
      setIsDrillFetching(false);

      if (!response.success || !response.group_rows) {
        throw new Error(response.error ?? "Drill-down returned no data.");
      }

      return response.group_rows;
    },
    [state.config, state.setup]
  );

  // Derived values for the group count info passed to ClassicReportView.
  const loadedGroupCount = activeNestedData?.groups.length ?? 0;
  const totalGroupCount = nestedData?.totalGroupCount ?? loadedGroupCount;
  const groupsCapped = nestedData?.groupsCapped ?? false;
  const groupFieldLabel = nestedData?.groups[0]?.label ?? "Group";
  const groupCountInfo = isNested && groupsCapped
    ? { label: groupFieldLabel, loaded: loadedGroupCount, total: totalGroupCount, capped: true }
    : undefined;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/*
        Classic View — shown when viewMode === "classic"
      */}
      {!isPrint && (
        <div className="flex-1 overflow-auto p-4">
          {/* Expand-all loading / warn-large banner for collapseBody=false */}
          {wantsExpand && expandedNestedData === null && (
            <div className="mb-3 px-4 py-3 rounded-lg border flex items-center gap-3 text-sm
              bg-amber-50 border-amber-200 text-amber-800">
              {expandLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity={0.25} />
                    <path d="M21 12a9 9 0 00-9-9" />
                  </svg>
                  <span>Loading all row data…</span>
                </>
              ) : expandWarnLarge ? (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span className="flex-1">
                    This report has <strong>{expandWarnLarge.rowCount.toLocaleString()}</strong> rows. Loading all body data will likely freeze the UI — the browser must render a very large number of elements at once. Proceed only if necessary.
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchExpandAll(true)}
                    className="px-3 py-1 text-xs font-semibold rounded bg-amber-700 text-white hover:bg-amber-800 shrink-0"
                  >
                    Load anyway
                  </button>
                </>
              ) : null}
            </div>
          )}

          <div className="w-full bg-white rounded-lg border border-slate-200 shadow-sm p-4">
            {loadMoreError && (
              <p className="text-xs text-red-600 mb-2">{loadMoreError}</p>
            )}
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
              groupCountInfo={groupCountInfo}
              onLoadMore={handleLoadMore}
              loadMoreLoading={loadMoreLoading}
            />
          </div>
        </div>
      )}

      {/*
        Print View — DynamicReport is ALWAYS kept mounted (even when in Classic mode)
        by placing it in an absolutely-positioned, off-screen container.
      */}
      {/* Print loading / warn-large overlay — only visible when isPrint */}
      {isPrint && isNested && printNestedData === null && (
        <div className="flex-1 flex items-center justify-center bg-white">
          {printLoading ? (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity={0.2} />
                <path d="M21 12a9 9 0 00-9-9" />
              </svg>
              <span className="text-sm font-medium">Loading all row data for print…</span>
            </div>
          ) : printWarnLarge ? (
            <div className="flex flex-col items-center gap-4 max-w-sm text-center p-8">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Large report</p>
                <p className="text-sm text-slate-500 mt-1">
                  This report has <strong>{printWarnLarge.rowCount.toLocaleString()}</strong> rows.
                  Loading all body data for print will render a very large number of elements and may freeze the UI temporarily.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fetchPrintNestedData(true)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Load all rows for print
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* SQL Execution Floater — shows queries executed during drilldown */}
      <SqlExecutionFloater currentStep={drillSqlStep} isGenerating={isDrillFetching} />

      <div
        style={
          isPrint && (!isNested || printNestedData !== null)
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
          active={isPrint}
        />
      </div>
    </div>
  );
}
