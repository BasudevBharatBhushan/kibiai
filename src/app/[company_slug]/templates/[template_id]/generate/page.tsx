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
import type { ReportChartSchema } from "@/lib/charts/ChartTypes";
import { extractBodyRows } from "@/lib/charts/supabaseAdapters";
import {
  Zap, Loader2, SlidersHorizontal, BarChart3,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Plus, Trash2, Clock, FileText, RefreshCw, X, CheckCircle2,
} from "lucide-react";
import React from "react";

// ── Ad-hoc filter row ──────────────────────────────────────────────────────────
interface AdHocFilter { id: string; table: string; field: string; value: string; }

function AdHocFilterBuilder({
  filters, onChange, options
}: { filters: AdHocFilter[]; onChange: (f: AdHocFilter[]) => void; options: any[] }) {
  const add = () => onChange([...filters, { id: Date.now().toString(), table: "", field: "", value: "" }]);
  const remove = (id: string) => onChange(filters.filter(f => f.id !== id));
  const update = (id: string, key: string, val: string) => {
    if (key === "field") {
      const opt = options.find(o => `${o.table}.${o.field}` === val);
      onChange(filters.map(f => f.id === id ? { ...f, table: opt?.table || "", field: opt?.field || "" } : f));
    } else {
      onChange(filters.map(f => f.id === id ? { ...f, [key]: val } : f));
    }
  };

  return (
    <div className="space-y-2">
      {filters.map(f => (
        <div key={f.id} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1 duration-200">
          <select
            value={f.table && f.field ? `${f.table}.${f.field}` : ""}
            onChange={e => update(f.id, "field", e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
          >
            <option value="">Select Field...</option>
            {options.map(opt => (
              <option key={`${opt.table}.${opt.field}`} value={`${opt.table}.${opt.field}`}>
                {opt.label} ({opt.table})
              </option>
            ))}
          </select>
          <input
            placeholder="Value"
            value={f.value}
            onChange={e => update(f.id, "value", e.target.value)}
            className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
          />
          <button onClick={() => remove(f.id)} className="p-1.5 text-slate-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 shrink-0">
            <Trash2 size={13} />
          </button>
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
      {ranges.map(r => (
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
              {options.filter(o => o.type === "date").map(opt => (
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
      ))}
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
function SavedReportsList({ templateId, onLoad }: {
  templateId: string;
  onLoad: (data: any[]) => void;
}) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="space-y-1.5 max-h-48 overflow-y-auto">
      {reports.map(r => (
        <button
          key={r.report_id}
          onClick={() => r.report_data_json && onLoad(r.report_data_json)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-blue-50 text-left transition-colors border border-transparent hover:border-blue-100 group"
        >
          <FileText size={13} className="text-slate-300 group-hover:text-blue-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-700 truncate">{r.report_name}</p>
            <p className="text-[10px] text-slate-400">{new Date(r.created_on).toLocaleString()}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Chart Modal (full interactive — drag/resize/type change) ───────────────────
function ChartModal({ open, onClose, schemas, canvasState, rows, layoutMode, templateId }: {
  open: boolean;
  onClose: () => void;
  schemas: ReportChartSchema[];
  canvasState: any[];
  rows: any[];
  layoutMode: string;
  templateId: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-white border-b border-slate-200 px-6 py-3.5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-50 rounded-xl flex items-center justify-center">
            <BarChart3 size={16} className="text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Chart Dashboard</p>
            <p className="text-[10px] text-slate-400 font-medium">
              Drag to rearrange · Click type to change · Live report data
            </p>
          </div>
          {rows.length > 0 && (
            <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-bold border border-emerald-200">
              {rows.length} rows · Live data
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700"
        >
          <X size={18} />
        </button>
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
          // Full interactive DashboardProvider — same as admin chart builder
          // isViewerMode is intentionally omitted (defaults to false)
          // so drag-drop, resize, and chart-type switching all work
          <DashboardProvider
            initialSchemas={schemas}
            initialDataset={rows}
            initialCanvasState={canvasState}
            initialLayoutMode={layoutMode}
            templateId={templateId}
          >
            <DashboardGrid />
          </DashboardProvider>
        )}
      </div>
    </div>
  );
}

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
  const [templateName, setTemplateName] = useState("");
  const [configJson, setConfigJson] = useState<any>(null);
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [savedReportName, setSavedReportName] = useState<string>("");
  const [hasSetup, setHasSetup] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [configOpen, setConfigOpen] = useState(true);
  const historyRefreshKey = useRef(0);
  const [historyKey, setHistoryKey] = useState(0);

  // Chart modal state
  const [chartsModalOpen, setChartsModalOpen] = useState(false);
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

    // Ad-hoc filters
    adHocFilters.forEach(f => {
      if (f.table && f.field && f.value) {
        if (!cfPayload[f.table]) cfPayload[f.table] = {};
        cfPayload[f.table][f.field] = f.value;
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

  // Generate report
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: any }>(
        `/api/templates/${templateId}/generate`,
        { 
          runtime_filters: buildRuntimeFilters(),
          report_header: savedReportName || undefined
        }
      );
      if (!res.success) throw new Error("Generation failed");

      const structured = res.data?.report_structure_json;
      const heading = res.data?.report_name ?? templateName ?? "Report";

      setReportData(structured);
      setSavedReportName(heading);
      dispatch({ type: "SET_REPORT_PREVIEW", payload: structured });

      // Refresh history list
      historyRefreshKey.current++;
      setHistoryKey(historyRefreshKey.current);

      // Extract flat rows for chart modal
      const rows = extractBodyRows(structured);
      setChartRows(rows);

      // Pre-fetch chart schemas in background
      fetchChartSchemas();

      addToast("success", "Report Generated", `"${heading}" saved to history.`);
    } catch (err: any) {
      addToast("error", "Error", err.message || "Report generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }, [templateId, buildRuntimeFilters, fetchChartSchemas, dispatch, addToast, templateName]);

  // Open chart modal (ensure schemas loaded first)
  const handleViewCharts = useCallback(async () => {
    if (!chartSchemasFetched) {
      await fetchChartSchemas();
    }
    setChartsModalOpen(true);
  }, [chartSchemasFetched, fetchChartSchemas]);

  // Page loading skeleton
  if (isPageLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] animate-pulse">
        <div className="w-[380px] shrink-0 bg-white border-r border-slate-200" />
        <div className="flex-1 bg-gray-100" />
      </div>
    );
  }

  const dateRangeFields: Record<string, Record<string, string>> = configJson?.date_range_fields || {};
  const filterFields: Record<string, Record<string, any>> = configJson?.filters || {};

  return (
    <>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50">

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
                  onLoad={data => {
                    setReportData(data);
                    const heading = Array.isArray(data) 
                      ? data.find((i: any) => i && "TitleHeader" in i)?.TitleHeader?.MainHeading 
                      : null;
                    setSavedReportName(heading || templateName || "");
                    dispatch({ type: "SET_REPORT_PREVIEW", payload: data });
                    setChartRows(extractBodyRows(data));
                  }}
                />
              </CollapsibleSection>

            </div>
          )}
        </div>

        {/* ── RIGHT: Report Preview ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Preview area */}
          <div className="flex-1 overflow-auto bg-gray-100 relative">
            {!reportData ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-slate-100">
                  <Zap size={32} className="text-blue-200" />
                </div>
                <p className="text-base font-bold text-slate-400">Ready to generate</p>
                <p className="text-sm text-slate-300 mt-1">Configure filters and click Generate</p>
              </div>
            ) : (
              <div className="h-full">
                <DynamicReport jsonData={reportData} />
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
                onClick={handleViewCharts}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
              >
                <BarChart3 size={14} />
                View Charts
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Chart Modal ──────────────────────────────────────────────── */}
      <ChartModal
        open={chartsModalOpen}
        onClose={() => setChartsModalOpen(false)}
        schemas={chartSchemas}
        canvasState={chartCanvasState}
        rows={chartRows}
        layoutMode={chartLayoutMode}
        templateId={templateId}
      />
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
