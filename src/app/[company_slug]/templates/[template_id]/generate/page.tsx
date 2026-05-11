"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, usePathname } from "next/navigation";
import { useHeader } from "@/context/HeaderContext";
import { useAccessControl } from "@/context/AccessControlContext";
import { apiClient } from "@/utils/apiClient";
import { useToast } from "@/context/ToastContext";
import { ReportProvider, useReport } from "@/context/ReportContext";
import { DashboardProvider } from "@/context/DashboardContext";
import DashboardGrid from "@/components/chart-dashboard/DashboardGrid";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import DynamicReport from "@/components/DynamicReportPreview";
import type { ReportChartSchema, InsightContext } from "@/lib/charts/ChartTypes";
import { extractBodyRows } from "@/lib/charts/supabaseAdapters";
import { buildInsightContextFromState } from "@/lib/charts/insightContextBuilder";
import { buildReportMetadata, formatDisplayDate } from "@/lib/utils/reportMetadata";
import {
  Zap, Loader2, SlidersHorizontal, BarChart3,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Plus, Trash2, Clock, FileText, RefreshCw, X, CheckCircle2,
  Maximize2, Minimize2,
} from "lucide-react";
import React from "react";

import { FILTER_OPERATORS } from "@/constants/reportOptions";

// ── Parse a saved filter value like ">=10" / "==John" / "*" into ad-hoc shape ──
function parseSavedFilterValue(saved: string): { operator: string; value: string } {
  if (saved === '*' || saved === '=') return { operator: saved, value: '' };
  const multiCharOps = ['==', '!=', '>=', '<='];
  for (const op of multiCharOps) {
    if (saved.startsWith(op)) return { operator: op, value: saved.slice(op.length) };
  }
  const singleCharOps = ['>', '<'];
  for (const op of singleCharOps) {
    if (saved.startsWith(op)) return { operator: op, value: saved.slice(op.length) };
  }
  return { operator: '==', value: saved };
}

// ── Ad-hoc filter row ──────────────────────────────────────────────────────────
interface AdHocFilter { id: string; table: string; field: string; operator: string; value: string; }

function AdHocFilterBuilder({
  filters, onChange, options
}: { filters: AdHocFilter[]; onChange: (f: AdHocFilter[]) => void; options: any[] }) {
  const add = () => onChange([...filters, { id: Date.now().toString(), table: "", field: "", operator: "==", value: "" }]);
  const remove = (id: string) => onChange(filters.filter(f => f.id !== id));
  const update = (id: string, key: string, val: string) => {
    if (key === "field") {
      const opt = options.find(o => `${o.table}.${o.field}` === val);
      onChange(filters.map(f => f.id === id ? { ...f, table: opt?.table || "", field: opt?.field || "", operator: f.operator || "==" } : f));
    } else {
      onChange(filters.map(f => f.id === id ? { ...f, [key]: val } : f));
    }
  };

  return (
    <div className="space-y-2">
      {filters.map(f => (
        <div key={f.id} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Row 1: Field selector + delete */}
          <div className="flex gap-2 items-center">
            <select
              value={f.table && f.field ? `${f.table}.${f.field}` : ""}
              onChange={e => update(f.id, "field", e.target.value)}
              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white min-w-0"
            >
              <option value="">Select Field...</option>
              {options.map(opt => (
                <option key={`${opt.table}.${opt.field}`} value={`${opt.table}.${opt.field}`}>
                  {opt.label} ({opt.table})
                </option>
              ))}
            </select>
            <button onClick={() => remove(f.id)} className="p-1.5 text-slate-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 shrink-0">
              <Trash2 size={13} />
            </button>
          </div>
          {/* Row 2: Operator + Value */}
          <div className="flex gap-2 items-center">
            <select
              value={f.operator || "=="}
              onChange={e => update(f.id, "operator", e.target.value)}
              className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            >
              {FILTER_OPERATORS.map(op => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            <input
              placeholder="Value..."
              value={f.value}
              onChange={e => update(f.id, "value", e.target.value)}
              disabled={["*", "="].includes(f.operator)}
              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium disabled:opacity-40 disabled:bg-slate-50 min-w-0"
            />
          </div>
        </div>
      ))}
      <button onClick={add}
        className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors mt-1">
        <Plus size={12} /> Add Filter
      </button>
    </div>
  );
}

// ── Ad-hoc date range row ──────────────────────────────────────────────────────
interface AdHocDateRange { id: string; table: string; field: string; from: string; to: string; }

function AdHocDateRangeBuilder({
  ranges, onChange, options
}: { ranges: AdHocDateRange[]; onChange: (r: AdHocDateRange[]) => void; options: any[] }) {
  // Fields already selected by another row
  const usedKeys = new Set(ranges.map(r => r.table && r.field ? `${r.table}.${r.field}` : null).filter(Boolean));

  const add = () => onChange([...ranges, { id: Date.now().toString(), table: "", field: "", from: "", to: "" }]);
  const remove = (id: string) => onChange(ranges.filter(r => r.id !== id));
  const update = (id: string, key: string, val: any) => {
    if (key === "field") {
      const opt = options.find(o => `${o.table}.${o.field}` === val);
      onChange(ranges.map(r => r.id === id ? { ...r, table: opt?.table || "", field: opt?.field || "" } : r));
    } else if (key === "range") {
      onChange(ranges.map(r => r.id === id ? { ...r, from: val.from, to: val.to } : r));
    }
  };

  return (
    <div className="space-y-3">
      {ranges.map(r => {
        const currentKey = r.table && r.field ? `${r.table}.${r.field}` : null;
        // Available options: date fields not already used by OTHER rows
        const available = options.filter(o => {
          const k = `${o.table}.${o.field}`;
          return o.type === "date" && (!usedKeys.has(k) || k === currentKey);
        });
        return (
          <div key={r.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 relative group animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => remove(r.id)} className="absolute -top-2 -right-2 p-1.5 bg-white border border-slate-200 text-slate-300 hover:text-red-500 transition-all rounded-full shadow-sm z-10 hover:scale-110 active:scale-95">
              <X size={12} />
            </button>
            <div className="space-y-2">
              <select
                value={r.table && r.field ? `${r.table}.${r.field}` : ""}
                onChange={e => update(r.id, "field", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white font-bold text-slate-700"
              >
                <option value="">Select Date Field...</option>
                {available.map(opt => (
                  <option key={`${opt.table}.${opt.field}`} value={`${opt.table}.${opt.field}`}>
                    {opt.label} ({opt.table})
                  </option>
                ))}
              </select>
              <DateRangePicker
                value={{ from: r.from, to: r.to }}
                onChange={v => update(r.id, "range", v)}
              />
            </div>
          </div>
        );
      })}
      <button onClick={add}
        className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors mt-1">
        <Plus size={12} /> Add Date Range
      </button>
    </div>
  );
}

// ── Collapsible Section ────────────────────────────────────────────────────────
function CollapsibleSection({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
          {icon}{title}
        </div>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

// ── Saved Reports List ─────────────────────────────────────────────────────────
function SavedReportsList({ templateId, templateSetupJson, onSelectReport }: {
  templateId: string;
  templateSetupJson: Record<string, unknown> | null;
  onSelectReport: (reportId: string) => Promise<void> | void;
}) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: any[] }>(
        `/api/reports?template_id=${templateId}&limit=10`
      );
      if (res.success) setReports(res.data ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  if (loading) return (
    <div className="space-y-2 animate-pulse">
      {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-slate-50 rounded-lg" />)}
    </div>
  );

  if (reports.length === 0) return (
    <p className="text-xs text-slate-400 italic py-2">No saved reports yet.</p>
  );

  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto">
      {reports.map(r => {
        const isLoading = loadingReportId === r.report_id;
        const metadata = buildReportMetadata(r.report_config_json ?? null, templateSetupJson);
        const dateLine = metadata?.dateRange
          ? `${formatDisplayDate(metadata.dateRange.start)} — ${formatDisplayDate(metadata.dateRange.end)}${metadata.dateRange.field ? ` · ${metadata.dateRange.field}` : ""}`
          : null;
        const filtersLine = metadata?.filters && metadata.filters.length > 0
          ? metadata.filters.join(" · ")
          : null;
        const tooltip = [
          dateLine && `Date Range: ${dateLine}`,
          filtersLine && `Filters: ${filtersLine}`,
        ].filter(Boolean).join("\n");

        return (
          <button
            key={r.report_id}
            disabled={isLoading}
            onClick={async () => {
              setLoadingReportId(r.report_id);
              try {
                await onSelectReport(r.report_id);
              } finally {
                setLoadingReportId(null);
              }
            }}
            title={tooltip || undefined}
            className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg hover:bg-blue-50 text-left transition-colors border border-transparent hover:border-blue-100 group disabled:opacity-60"
          >
            {isLoading
              ? <Loader2 size={13} className="text-blue-400 shrink-0 animate-spin mt-0.5" />
              : <FileText size={13} className="text-slate-300 group-hover:text-blue-400 shrink-0 mt-0.5" />
            }
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-700 truncate">{r.report_name}</p>
              <p className="text-[10px] text-slate-400">{new Date(r.created_on).toLocaleString()}</p>
              {dateLine && (
                <p className="text-[10px] text-slate-500 mt-0.5 truncate flex items-center gap-1">
                  <Clock size={9} className="text-slate-400 shrink-0" />
                  <span className="truncate">{dateLine}</span>
                </p>
              )}
              {filtersLine && (
                <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                  <SlidersHorizontal size={9} className="text-slate-400 shrink-0" />
                  <span className="truncate">{filtersLine}</span>
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Chart Panel (split + modal modes — fully interactive) ────────────────────
// React.memo prevents this from re-rendering on every parent state change,
// which was causing DashboardProvider to unmount/remount in a loop.
type ChartViewMode = 'split' | 'modal';

const ChartPanel = React.memo(function ChartPanel({
  mode, onExpand, onCollapse, onClose, schemas, canvasState, rows, layoutMode, templateId, context
}: {
  mode: ChartViewMode;
  onExpand: () => void;
  onCollapse: () => void;
  onClose: () => void;
  schemas: ReportChartSchema[];
  canvasState: any[];
  rows: any[];
  layoutMode: string;
  templateId: string;
  context?: InsightContext;
}) {
  const isModal = mode === 'modal';

  // Outer container: fixed fullscreen overlay in modal mode, inline pane in split mode.
  // Same React tree in both cases → DashboardProvider stays mounted across mode switches.
  const containerClass = isModal
    ? "fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex flex-col"
    : "h-full w-full flex flex-col bg-white border-l border-slate-200 shadow-sm";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className={`flex items-center justify-between bg-white border-b border-slate-200 shrink-0 ${isModal ? "px-6 py-3.5" : "px-4 py-2.5"}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`shrink-0 flex items-center justify-center rounded-xl bg-purple-50 ${isModal ? "w-8 h-8" : "w-7 h-7"}`}>
            <BarChart3 size={isModal ? 16 : 14} className="text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className={`font-bold text-slate-800 truncate ${isModal ? "text-sm" : "text-[13px]"}`}>Chart Dashboard</p>
            {isModal && (
              <p className="text-[10px] text-slate-400 font-medium">
                Drag to rearrange · Click type to change · Live report data
              </p>
            )}
          </div>
          {isModal && rows.length > 0 && (
            <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-bold border border-emerald-200 shrink-0">
              {rows.length} rows · Live data
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isModal ? (
            <button
              onClick={onCollapse}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700"
              title="Collapse to split view"
            >
              <Minimize2 size={16} />
            </button>
          ) : (
            <button
              onClick={onExpand}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700"
              title="Expand to full view"
            >
              <Maximize2 size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className={`hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700 ${isModal ? "p-2" : "p-1.5"}`}
            title="Close charts"
          >
            <X size={isModal ? 18 : 14} />
          </button>
        </div>
      </div>

      {/* Body — overflow-y-auto so charts are scrollable */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {schemas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-slate-100">
              <BarChart3 size={28} className="text-slate-200" />
            </div>
            <p className="text-sm font-bold text-slate-400">No chart templates defined</p>
            <p className="text-xs text-slate-300 mt-1">
              Ask an admin to create chart templates for this report template.
            </p>
          </div>
        ) : (
          // When context is present this is a historical report view:
          // isViewerMode disables auto-save while context bypasses stale date filters.
          <DashboardProvider
            initialSchemas={schemas}
            initialDataset={rows}
            initialCanvasState={canvasState}
            initialLayoutMode={layoutMode}
            templateId={templateId}
            context={context}
            isViewerMode={!!context}
          >
            <DashboardGrid />
          </DashboardProvider>
        )}
      </div>
    </div>
  );
});

// ── Main Page Content ──────────────────────────────────────────────────────────
function GeneratePageContent({ templateId, slug }: { templateId: string; slug: string }) {
  const { state, dispatch } = useReport();
  const { addToast } = useToast();
  const { setBreadcrumbs, setBackHref } = useHeader();
  const { activeView } = useAccessControl();
  const pathname = usePathname();
  const isUserView = activeView === "user";

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [configJson, setConfigJson] = useState<any>(null);
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [savedReportName, setSavedReportName] = useState<string>("");
  const [hasSetup, setHasSetup] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [configOpen, setConfigOpen] = useState(true);
  const historyRefreshKey = useRef(0);
  const [historyKey, setHistoryKey] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Chart view state: 'none' (hidden), 'split' (right pane half), 'modal' (fullscreen overlay)
  const [chartsView, setChartsView] = useState<'none' | ChartViewMode>('none');
  const [chartSchemas, setChartSchemas] = useState<ReportChartSchema[]>([]);
  const [chartCanvasState, setChartCanvasState] = useState<any[]>([]);
  const [chartLayoutMode, setChartLayoutMode] = useState("grid");
  const [chartRows, setChartRows] = useState<any[]>([]);
  const [chartSchemasFetched, setChartSchemasFetched] = useState(false);

  // Filter state
  const [dateRanges, setDateRanges] = useState<Record<string, Record<string, { from: string; to: string }>>>({});
  const [configFilters, setConfigFilters] = useState<Record<string, Record<string, string>>>({});
  const [adHocFilters, setAdHocFilters] = useState<AdHocFilter[]>([]);
  const [adHocDateRanges, setAdHocDateRanges] = useState<AdHocDateRange[]>([]);

  // Derive the dashboard's InsightContext from the current filter state. Falls
  // back to the template's default date_range_fields if the user hasn't touched
  // anything, so the chart cards always show the effective window — whether
  // we're viewing a fresh generation or a loaded historical report.
  const viewerContext = useMemo<InsightContext | undefined>(
    () => buildInsightContextFromState({
      dateRanges,
      adHocDateRanges,
      templateConfigJson: configJson,
      templateSetupJson: (state.setup as unknown as Record<string, unknown>) ?? null,
    }),
    [dateRanges, adHocDateRanges, configJson, state.setup]
  );

  // Effective config = template defaults overlaid with anything in current state.
  // Used to render the date-range + filter subheader on the preview, matching
  // what the engine will actually apply when Generate is pressed.
  const previewMetadata = useMemo(() => {
    const effectiveDateRangeFields: Record<string, Record<string, string>> = {
      ...((configJson?.date_range_fields ?? {}) as Record<string, Record<string, string>>),
    };
    for (const [table, fields] of Object.entries(dateRanges)) {
      for (const [field, { from, to }] of Object.entries(fields)) {
        if (from && to) {
          effectiveDateRangeFields[table] = {
            ...(effectiveDateRangeFields[table] ?? {}),
            [field]: `${from}...${to}`,
          };
        }
      }
    }
    for (const r of adHocDateRanges) {
      if (r.table && r.field && r.from && r.to) {
        if (!effectiveDateRangeFields[r.table]) effectiveDateRangeFields[r.table] = {};
        effectiveDateRangeFields[r.table][r.field] = `${r.from}...${r.to}`;
      }
    }

    const effectiveFilters: Record<string, Record<string, string>> = {
      ...((configJson?.filters ?? {}) as Record<string, Record<string, string>>),
    };
    for (const [table, fields] of Object.entries(configFilters)) {
      for (const [field, value] of Object.entries(fields)) {
        if (value) {
          effectiveFilters[table] = {
            ...(effectiveFilters[table] ?? {}),
            [field]: value,
          };
        }
      }
    }
    for (const f of adHocFilters) {
      if (f.table && f.field) {
        const finalVal = ["*", "="].includes(f.operator)
          ? f.operator
          : f.value
            ? `${f.operator}${f.value}`
            : "";
        if (!finalVal) continue;
        if (!effectiveFilters[f.table]) effectiveFilters[f.table] = {};
        effectiveFilters[f.table][f.field] = finalVal;
      }
    }

    return buildReportMetadata(
      { date_range_fields: effectiveDateRangeFields, filters: effectiveFilters },
      (state.setup as unknown as Record<string, unknown>) ?? null
    );
  }, [configJson, dateRanges, adHocDateRanges, configFilters, adHocFilters, state.setup]);

  // Memoized available fields based on report columns and subsummaries
  const availableFields = useMemo<{ table: string; field: string; label: string; type: string }[]>(() => {
    const setup = state.setup;
    if (!configJson || !setup) return [];
    
    const fieldMap = new Map<string, { table: string; field: string; label: string; type: string }>();

    // 1. Fields from Columns
    (configJson.report_columns || []).forEach((col: any) => {
      if (!col.table || !col.field || col.table === "calculated") return;
      const key = `${col.table}.${col.field}`;
      if (!fieldMap.has(key)) {
        const fieldDef = setup.tables?.[col.table]?.fields?.[col.field];
        fieldMap.set(key, { 
          table: col.table, 
          field: col.field, 
          label: fieldDef?.label || col.field, 
          type: fieldDef?.type || "text" 
        });
      }
    });

    // 2. Fields from Grouping (Subsummaries)
    Object.values(configJson.group_by_fields || {}).forEach((group: any) => {
      if (!group.table || !group.field) return;
      const key = `${group.table}.${group.field}`;
      if (!fieldMap.has(key)) {
        const fieldDef = setup.tables?.[group.table]?.fields?.[group.field];
        fieldMap.set(key, { 
          table: group.table, 
          field: group.field, 
          label: fieldDef?.label || group.field, 
          type: fieldDef?.type || "text" 
        });
      }
    });

    return Array.from(fieldMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [configJson, state.setup]);

  // Always hide breadcrumbs on the Generate page (considered "User Mode" for everyone)
  useEffect(() => {
    setBreadcrumbs([]);
  }, [setBreadcrumbs, pathname]);

  // Load template config on mount
  useEffect(() => {
    if (!templateId) return;
    const load = async () => {
      setIsPageLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: any }>(`/api/templates/${templateId}/config`);
        if (!res.success || !res.data) throw new Error("Template not found");
        const { data } = res;
        setTemplateName(data.template_name || "Report");
        setSavedReportName(data.config_json?.report_header || data.template_name || "Report");
        setConfigJson(data.config_json);
        setHasSetup(data.has_setup ?? false);
        setHasConfig(data.has_config ?? false);

        dispatch({
          type: "LOAD_FULL_REPORT",
          payload: { config: data.config_json, setup: data.setup_json, templateId: data.template_id, conversationId: null },
        });

        if (isUserView) {
          setBackHref(`/${slug}/templates`);
        } else {
          setBackHref(`/${slug}/templates/${templateId}/configurator`);
        }
      } catch (err: any) {
        addToast("error", "Load Error", err.message || "Failed to load template.");
      } finally {
        setIsPageLoading(false);
      }
    };
    load();
  }, [templateId, slug, isUserView, setBackHref, dispatch, addToast]);

  // Runtime filter payload builder
  const buildRuntimeFilters = useCallback(() => {
    const payload: any = {};

    const drPayload: any = {};
    // Pre-configured date ranges
    Object.entries(dateRanges).forEach(([table, fields]) => {
      Object.entries(fields).forEach(([field, { from, to }]) => {
        if (from && to) {
          if (!drPayload[table]) drPayload[table] = {};
          drPayload[table][field] = `${from}...${to}`;
        }
      });
    });

    // Ad-hoc date ranges
    adHocDateRanges.forEach(r => {
      if (r.table && r.field && r.from && r.to) {
        if (!drPayload[r.table]) drPayload[r.table] = {};
        drPayload[r.table][r.field] = `${r.from}...${r.to}`;
      }
    });

    if (Object.keys(drPayload).length) payload.date_range_fields = drPayload;

    const cfPayload: any = {};
    // Pre-configured filters
    Object.entries(configFilters).forEach(([table, fields]) => {
      Object.entries(fields).forEach(([field, val]) => {
        if (val) { if (!cfPayload[table]) cfPayload[table] = {}; cfPayload[table][field] = val; }
      });
    });

    // Ad-hoc filters — prepend operator to value (mirrors ReportFiltersSection logic)
    adHocFilters.forEach(f => {
      if (f.table && f.field) {
        const finalVal = ["*", "="].includes(f.operator)
          ? f.operator
          : `${f.operator}${f.value}`;
        if (finalVal && finalVal !== "==") {
          if (!cfPayload[f.table]) cfPayload[f.table] = {};
          cfPayload[f.table][f.field] = finalVal;
        }
      }
    });

    if (Object.keys(cfPayload).length) payload.filters = cfPayload;

    return payload;
  }, [dateRanges, configFilters, adHocFilters, adHocDateRanges]);

  // Fetch chart schemas lazily (once per session)
  const fetchChartSchemas = useCallback(async () => {
    if (chartSchemasFetched) return;
    try {
      const cr = await apiClient.get<{
        success: boolean;
        data?: { schemas: ReportChartSchema[]; canvasState: any[]; layoutMode: string };
      }>(`/api/report-templates/${templateId}/charts`);

      if (cr.success && cr.data) {
        setChartSchemas(cr.data.schemas ?? []);
        setChartCanvasState(cr.data.canvasState ?? []);
        setChartLayoutMode(cr.data.layoutMode ?? "grid");
      }
    } catch { /* charts are optional */ } finally {
      setChartSchemasFetched(true);
    }
  }, [templateId, chartSchemasFetched]);

  // Generate report via SSE stream
  const handleGenerate = useCallback(async () => {
    // Cancel any previous in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setGenerationLogs([]);
    setReportData(null);

    try {
      const response = await fetch(`/api/templates/${templateId}/generate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runtime_filters: buildRuntimeFilters(),
          report_header: savedReportName || undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || `Server error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are delimited by double newlines
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.replace(/^data: /, "").trim();
          if (!line) continue;
          let event: any;
          try { event = JSON.parse(line); } catch { continue; }

          if (event.type === "log") {
            setGenerationLogs(prev => [...prev, event.message as string]);
          } else if (event.type === "done") {
            const structured = event.report_structure_json;
            const heading = event.report_name ?? templateName ?? "Report";

            setReportData(structured);
            setSavedReportName(heading);
            dispatch({ type: "SET_REPORT_PREVIEW", payload: structured });
            // viewerContext is derived from current filter state — no manual reset needed.

            historyRefreshKey.current++;
            setHistoryKey(historyRefreshKey.current);

            const rows = extractBodyRows(structured);
            setChartRows(rows);
            fetchChartSchemas();

            addToast("success", "Report Generated", `"${heading}" saved to history.`);
          } else if (event.type === "error") {
            throw new Error(event.message || "Report generation failed.");
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        addToast("error", "Error", err.message || "Report generation failed.");
      }
    } finally {
      setIsGenerating(false);
    }
  }, [templateId, buildRuntimeFilters, savedReportName, fetchChartSchemas, dispatch, addToast, templateName]);

  // Open chart panel in split view (ensure schemas loaded first).
  // Also auto-collapse the left filter panel so the charts have room to breathe.
  const handleViewCharts = useCallback(async () => {
    if (!chartSchemasFetched) {
      await fetchChartSchemas();
    }
    setChartsView('split');
    setConfigOpen(false);
  }, [chartSchemasFetched, fetchChartSchemas]);

  // Load a saved report from history: render its data AND prefill the
  // configurator so the user can re-run with the same parameters.
  const handleLoadFromHistory = useCallback(async (reportId: string) => {
    try {
      const res = await apiClient.get<{ success: boolean; data: any }>(
        `/api/reports/${reportId}`
      );
      if (!res.success || !res.data) {
        addToast("error", "Load Error", "Failed to load saved report.");
        return;
      }
      const report = res.data;
      const data = report.report_data_json;
      const savedConfig = (report.report_config_json ?? {}) as Record<string, any>;

      // 1. Render the report
      setReportData(data);
      const heading = Array.isArray(data)
        ? data.find((i: any) => i && "TitleHeader" in i)?.TitleHeader?.MainHeading
        : null;
      setSavedReportName(report.report_name || heading || templateName || "");
      dispatch({ type: "SET_REPORT_PREVIEW", payload: data });
      const rows = extractBodyRows(data);
      setChartRows(rows);

      // 2. Split the saved config into pre-configured (template-defined) vs ad-hoc
      //    so each section of the configurator UI prefills correctly.
      const templateDateFields = (configJson?.date_range_fields ?? {}) as Record<string, Record<string, string>>;
      const templateFilters = (configJson?.filters ?? {}) as Record<string, Record<string, unknown>>;

      const savedDateFields = (savedConfig.date_range_fields ?? {}) as Record<string, Record<string, string>>;
      const savedFilters = (savedConfig.filters ?? {}) as Record<string, Record<string, unknown>>;

      const nextDateRanges: Record<string, Record<string, { from: string; to: string }>> = {};
      const nextAdHocDateRanges: AdHocDateRange[] = [];

      for (const [table, fields] of Object.entries(savedDateFields)) {
        for (const [field, rangeStr] of Object.entries(fields)) {
          const parts = String(rangeStr).split("...");
          if (parts.length !== 2) continue;
          const [from, to] = parts;
          const isPreConfigured = !!templateDateFields[table]?.[field];
          if (isPreConfigured) {
            if (!nextDateRanges[table]) nextDateRanges[table] = {};
            nextDateRanges[table][field] = { from, to };
          } else {
            nextAdHocDateRanges.push({
              id: `${Date.now()}-${table}-${field}`,
              table,
              field,
              from,
              to,
            });
          }
        }
      }

      const nextConfigFilters: Record<string, Record<string, string>> = {};
      const nextAdHocFilters: AdHocFilter[] = [];

      for (const [table, fields] of Object.entries(savedFilters)) {
        for (const [field, rawValue] of Object.entries(fields)) {
          const value = String(rawValue ?? "");
          const isPreConfigured = !!templateFilters[table]?.[field];
          if (isPreConfigured) {
            if (!nextConfigFilters[table]) nextConfigFilters[table] = {};
            nextConfigFilters[table][field] = value;
          } else {
            const parsed = parseSavedFilterValue(value);
            nextAdHocFilters.push({
              id: `${Date.now()}-${table}-${field}`,
              table,
              field,
              operator: parsed.operator,
              value: parsed.value,
            });
          }
        }
      }

      setDateRanges(nextDateRanges);
      setAdHocDateRanges(nextAdHocDateRanges);
      setConfigFilters(nextConfigFilters);
      setAdHocFilters(nextAdHocFilters);

      addToast(
        "success",
        "Report Loaded",
        "Filters and date ranges restored from history."
      );
    } catch (err: any) {
      addToast("error", "Load Error", err.message || "Failed to load saved report.");
    }
  }, [configJson, templateName, dispatch, addToast]);

  // Page loading skeleton
  if (isPageLoading) {
    return (
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 flex h-[calc(100vh-64px)] overflow-hidden animate-pulse">
        {/* Left panel skeleton */}
        <div className="w-[380px] shrink-0 bg-white border-r border-slate-200 p-4 space-y-4">
          <div className="h-px bg-slate-100" />
          {/* Report heading input */}
          <div className="space-y-1.5">
            <div className="h-2.5 w-28 bg-slate-100 rounded" />
            <div className="h-9 bg-slate-100 rounded-xl" />
          </div>
          {/* Section blocks */}
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
              <div className="h-10 bg-slate-50" />
              <div className="p-4 space-y-2">
                <div className="h-8 bg-slate-100 rounded-lg" />
                <div className="h-8 bg-slate-100 rounded-lg" />
              </div>
            </div>
          ))}
          {/* Generate button */}
          <div className="h-10 bg-blue-100 rounded-xl" />
        </div>
        {/* Right preview skeleton */}
        <div className="flex-1 bg-gray-100 flex items-start justify-center pt-10">
          <div className="bg-white shadow-xl rounded w-[210mm] min-h-[297mm] p-8 space-y-4">
            <div className="flex justify-between mb-6">
              <div className="h-3 w-24 bg-slate-100 rounded" />
              <div className="h-7 w-48 bg-slate-100 rounded" />
            </div>
            <div className="h-px bg-slate-100" />
            {[...Array(14)].map((_, i) => (
              <div key={i} className="h-3 bg-slate-50 rounded" style={{ width: `${95 - (i % 3) * 10}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const dateRangeFields: Record<string, Record<string, string>> = configJson?.date_range_fields || {};


  const filterFields: Record<string, Record<string, any>> = configJson?.filters || {};

  return (
    <>
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50">

        {/* ── LEFT: Configuration Panel ─────────────────────────────── */}
        <div className={`bg-white border-r border-slate-200 flex flex-col shrink-0 transition-[width] duration-300 ${configOpen ? "w-[380px]" : "w-12"}`}>
          <button
            onClick={() => setConfigOpen(o => !o)}
            className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors w-full"
          >
            <SlidersHorizontal size={14} />
            {configOpen && <span className="flex-1 text-left uppercase tracking-wider">Report Configuration</span>}
            {configOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
          </button>

          {configOpen && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Report Heading Input */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Report Heading
                </label>
                <input
                  type="text"
                  placeholder="Enter custom report title..."
                  value={savedReportName}
                  onChange={e => setSavedReportName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                />
              </div>

              {/* Template subtitle */}
              <div className="flex items-center gap-2">
                <div className="w-1 h-3 bg-blue-500 rounded-full" />
                <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-tight">{templateName}</p>
              </div>

              {/* Date Ranges */}
              {(Object.keys(dateRangeFields).length > 0 || availableFields.some(f => f.type === "date")) && (
                <CollapsibleSection title="Date Ranges" icon={<Clock size={13} />}>
                  {/* Pre-configured Date Ranges */}
                  {Object.entries(dateRangeFields).map(([table, fields]) =>
                    Object.keys(fields).map(field => (
                      <DateRangePicker
                        key={`${table}.${field}`}
                        label={`${field.replace(/([A-Z])/g, ' $1').trim()} (${table})`}
                        value={dateRanges[table]?.[field] ?? { from: "", to: "" }}
                        onChange={v => setDateRanges(prev => ({
                          ...prev, [table]: { ...(prev[table] || {}), [field]: v },
                        }))}
                      />
                    ))
                  )}

                  {/* Ad-hoc Date Ranges */}
                  <div className={Object.keys(dateRangeFields).length > 0 ? "pt-2 border-t border-slate-100 mt-2" : ""}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2">Additional Date Ranges</p>
                    <AdHocDateRangeBuilder 
                      ranges={adHocDateRanges} 
                      onChange={setAdHocDateRanges} 
                      options={availableFields}
                    />
                  </div>
                </CollapsibleSection>
              )}

              {/* Template Filters */}
              {Object.keys(filterFields).length > 0 && (
                <CollapsibleSection title="Template Filters" icon={<SlidersHorizontal size={13} />}>
                  {Object.entries(filterFields).map(([table, fields]) =>
                    Object.entries(fields).map(([field, defaultVal]) => (
                      <div key={`${table}.${field}`}>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          {field.replace(/([A-Z])/g, ' $1').trim()} <span className="text-slate-300 ml-1">({table})</span>
                        </label>
                        <input
                          type="text"
                          placeholder={String(defaultVal) || "Filter value"}
                          value={configFilters[table]?.[field] ?? ""}
                          onChange={e => setConfigFilters(prev => ({
                            ...prev, [table]: { ...(prev[table] || {}), [field]: e.target.value },
                          }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                    ))
                  )}
                </CollapsibleSection>
              )}

              {/* Ad-hoc Filters (always visible) */}
              <CollapsibleSection
                title="Add Filters"
                icon={<Plus size={13} />}
                defaultOpen={Object.keys(filterFields).length === 0}
              >
                <AdHocFilterBuilder 
                  filters={adHocFilters} 
                  onChange={setAdHocFilters} 
                  options={availableFields}
                />
              </CollapsibleSection>

              {/* Generate + Reset buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  id="run-report-btn"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 hover:opacity-90"
                  style={{ background: "#2563eb" }}
                >
                  {isGenerating
                    ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
                    : <><Zap size={14} /> Generate</>}
                </button>
                <button
                  onClick={() => { 
                    setDateRanges({}); 
                    setConfigFilters({}); 
                    setAdHocFilters([]); 
                    setAdHocDateRanges([]);
                  }}
                  className="px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all"
                  title="Reset filters"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {/* Report History */}
              <CollapsibleSection title="Report History" icon={<Clock size={13} />} defaultOpen={false}>
                <SavedReportsList
                  key={historyKey}
                  templateId={templateId}
                  templateSetupJson={(state.setup as unknown as Record<string, unknown>) ?? null}
                  onSelectReport={handleLoadFromHistory}
                />
              </CollapsibleSection>

            </div>
          )}
        </div>

        {/* ── RIGHT: Report Preview (+ optional Chart Split) ─────────── */}
        <div className="flex-1 flex overflow-hidden">

        {/* Report preview side */}
        <div className={`${chartsView === 'split' ? 'w-[35%]' : 'flex-1'} flex flex-col overflow-hidden transition-[width] duration-200`}>

          {/* Preview area */}
          <div className="flex-1 overflow-auto bg-gray-100 relative">
            {isGenerating ? (
              /* ── Generating view: A4 skeleton with glass log overlay floating on top ── */
              <div className="flex items-start justify-center min-h-full pt-8 pb-8">
                {/* A4 paper skeleton — log panel floats absolutely on top of this */}
                <div
                  className="relative bg-white shadow-xl overflow-hidden"
                  style={{ width: "210mm", minHeight: "297mm", padding: "10mm 14mm", boxSizing: "border-box" }}
                >
                  {/* Shimmer overlay */}
                  <div className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 1.8s infinite",
                    }}
                  />

                  {/* Header skeleton */}
                  <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
                    <div className="space-y-1.5">
                      <div className="h-2.5 w-20 bg-slate-100 rounded animate-pulse" />
                      <div className="h-2 w-28 bg-slate-50 rounded animate-pulse" />
                    </div>
                    <div className="space-y-1.5 text-right">
                      <div className="h-5 w-56 bg-slate-100 rounded animate-pulse ml-auto" />
                      <div className="h-2.5 w-36 bg-slate-50 rounded animate-pulse ml-auto" />
                    </div>
                  </div>

                  {/* Body skeleton rows */}
                  <div className="space-y-3">
                    {/* Group header */}
                    <div className="h-3.5 w-48 bg-slate-200 rounded animate-pulse" />
                    <div className="h-px bg-slate-100 w-full" />
                    {/* Column headers */}
                    <div className="flex gap-4 py-1">
                      {[60, 80, 50, 70, 45, 55].map((w, i) => (
                        <div key={i} className="h-2 bg-slate-200 rounded animate-pulse" style={{ width: `${w}px` }} />
                      ))}
                    </div>
                    {/* Data rows */}
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="flex gap-4">
                        {[80, 60, 50, 70, 40, 55].map((w, j) => (
                          <div
                            key={j}
                            className="h-2 bg-slate-50 rounded animate-pulse"
                            style={{ width: `${w - (i % 3) * 8}px`, animationDelay: `${i * 60}ms` }}
                          />
                        ))}
                      </div>
                    ))}
                    {/* Subtotal line */}
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 mt-3">
                      <div className="h-2 w-20 bg-slate-100 rounded animate-pulse" />
                      <div className="h-2 w-14 bg-slate-200 rounded animate-pulse" />
                    </div>

                    {/* Second group */}
                    <div className="h-3.5 w-40 bg-slate-200 rounded animate-pulse mt-4" />
                    <div className="h-px bg-slate-100 w-full" />
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex gap-4">
                        {[70, 55, 48, 65, 38, 50].map((w, j) => (
                          <div
                            key={j}
                            className="h-2 bg-slate-50 rounded animate-pulse"
                            style={{ width: `${w - (i % 2) * 6}px`, animationDelay: `${i * 80 + 200}ms` }}
                          />
                        ))}
                      </div>
                    ))}
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                      <div className="h-2 w-20 bg-slate-100 rounded animate-pulse" />
                      <div className="h-2 w-14 bg-slate-200 rounded animate-pulse" />
                    </div>

                    {/* More rows */}
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="flex gap-4">
                        {[75, 60, 52, 68, 42, 52].map((w, j) => (
                          <div
                            key={j}
                            className="h-2 bg-slate-50 rounded animate-pulse"
                            style={{ width: `${w - (i % 4) * 5}px`, animationDelay: `${i * 50 + 400}ms` }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  {/* ── Log overlay — floating at center of skeleton ── */}
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-8 pointer-events-none">
                    <div className="w-full max-w-lg pointer-events-auto bg-white/[0.01] backdrop-blur-[1px] rounded-xl border border-white/5 shadow-none overflow-hidden min-h-[280px] flex flex-col justify-center">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="relative flex h-6 w-6 items-center justify-center shrink-0">
                          <Loader2 size={16} className="animate-spin text-blue-600" />
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-20" />
                        </div>
                        <p className="text-sm font-extrabold text-slate-900 flex-1">Generating Report…</p>
                        <span className="text-[11px] text-slate-500 tabular-nums font-bold bg-slate-100/50 px-2 py-0.5 rounded-full border border-slate-200/50">
                          {generationLogs.length} steps
                        </span>
                      </div>
                      <div
                        className="overflow-y-auto px-4 py-2 space-y-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                        style={{ maxHeight: "240px" }}
                        ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
                      >
                        {generationLogs.length === 0 ? (
                          <div className="flex items-center gap-2 py-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                            <p className="text-[11px] text-slate-400 italic">Initialising engine…</p>
                          </div>
                        ) : (
                          generationLogs.map((line, i) => {
                            const isSuccess = line.startsWith("✅");
                            const isWarning = line.toLowerCase().includes("warning") || line.startsWith("⚠");
                            const isError = line.startsWith("❌");
                            const isLast = i === generationLogs.length - 1;
                            return (
                              <div key={i} className="flex items-start gap-2 animate-in fade-in duration-150">
                                <div className={`mt-1 shrink-0 w-1.5 h-1.5 rounded-full ${
                                  isSuccess ? "bg-emerald-500" : isWarning ? "bg-amber-400" :
                                  isError ? "bg-red-500" : isLast ? "bg-blue-500 animate-pulse" : "bg-slate-300"
                                }`} />
                                <span className={`text-[12px] leading-relaxed ${
                                  isSuccess ? "text-emerald-800 font-semibold" : isWarning ? "text-amber-800" :
                                  isError ? "text-red-800 font-semibold" : isLast ? "text-slate-900 font-bold" : "text-slate-700"
                                }`}>
                                  {line.replace(/^[✅❌⚠️]\s*/, "")}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="h-1 bg-slate-100/30 mt-auto">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500 shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                          style={{ width: generationLogs.length === 0 ? "5%" : `${Math.min(95, (generationLogs.length / 15) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : !reportData ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-slate-100">
                  <Zap size={32} className="text-blue-200" />
                </div>
                <p className="text-base font-bold text-slate-400">Ready to generate</p>
                <p className="text-sm text-slate-300 mt-1">Configure filters and click Generate</p>
              </div>
            ) : (
              <div className="h-full">
                <DynamicReport jsonData={reportData!} metadata={previewMetadata} />
              </div>
            )}
          </div>

          {/* Status bar — shown after generation */}
          {reportData && (
            <div className="shrink-0 bg-white border-t border-slate-200 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <p className="text-xs text-slate-500">
                  Report saved ·{" "}
                  <span className="font-semibold text-slate-700">{savedReportName || templateName}</span>
                </p>
              </div>
              <button
                id="view-charts-btn"
                onClick={chartsView === 'split' ? () => setChartsView('none') : handleViewCharts}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
              >
                <BarChart3 size={14} />
                {chartsView === 'split' ? 'Hide Charts' : 'View Charts'}
              </button>
            </div>
          )}
        </div>
        {/* ── Charts inline pane (split mode) ──────────────────────── */}
        {chartsView === 'split' && (
          <div className="w-[65%] flex flex-col flex-shrink-0 overflow-hidden">
            <ChartPanel
              mode="split"
              onExpand={() => setChartsView('modal')}
              onCollapse={() => setChartsView('split')}
              onClose={() => setChartsView('none')}
              schemas={chartSchemas}
              canvasState={chartCanvasState}
              rows={chartRows}
              layoutMode={chartLayoutMode}
              templateId={templateId}
              context={viewerContext}
            />
          </div>
        )}
        </div>
      </div>

      {/* ── Chart Modal overlay (modal mode) ─────────────────────────── */}
      {chartsView === 'modal' && (
        <ChartPanel
          mode="modal"
          onExpand={() => setChartsView('modal')}
          onCollapse={() => setChartsView('split')}
          onClose={() => setChartsView('none')}
          schemas={chartSchemas}
          canvasState={chartCanvasState}
          rows={chartRows}
          layoutMode={chartLayoutMode}
          templateId={templateId}
          context={viewerContext}
        />
      )}
    </>
  );
}

// ── Page Route ─────────────────────────────────────────────────────────────────
export default function GeneratePage() {
  const params = useParams();
  return (
    <ReportProvider>
      <GeneratePageContent
        templateId={params?.template_id as string}
        slug={params?.company_slug as string}
      />
    </ReportProvider>
  );
}
