"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useHeader } from "@/context/HeaderContext";
import { apiClient } from "@/utils/apiClient";
import { useToast } from "@/context/ToastContext";
import { ReportPreview } from "@/components/ReportPreview";
import { ReportProvider, useReport } from "@/context/ReportContext";
import { Zap, RotateCcw, Save, ArrowLeft, Loader2, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

// ── Runtime Filter Form ────────────────────────────────────────────────────────
function RuntimeFiltersForm({
  configJson,
  filters,
  onFiltersChange,
}: {
  configJson: any;
  filters: Record<string, any>;
  onFiltersChange: (f: Record<string, any>) => void;
}) {
  const dateRangeFields: Record<string, Record<string, string>> =
    configJson?.date_range_fields || {};
  const filterFields: Record<string, Record<string, any>> = configJson?.filters || {};

  const hasFilters =
    Object.keys(dateRangeFields).length > 0 || Object.keys(filterFields).length > 0;

  if (!hasFilters) {
    return (
      <p className="text-sm text-slate-500 italic">
        No runtime filters defined in this template. The report will run with its configured default
        values.
      </p>
    );
  }

  const handleDateChange = (table: string, field: string, value: string) => {
    const existing = filters.date_range_fields || {};
    onFiltersChange({
      ...filters,
      date_range_fields: {
        ...existing,
        [table]: { ...(existing[table] || {}), [field]: value },
      },
    });
  };

  const handleFilterChange = (table: string, field: string, value: string) => {
    const existing = filters.filters || {};
    onFiltersChange({
      ...filters,
      filters: {
        ...existing,
        [table]: { ...(existing[table] || {}), [field]: value },
      },
    });
  };

  return (
    <div className="space-y-4">
      {Object.entries(dateRangeFields).map(([table, fields]) =>
        Object.entries(fields).map(([field, defaultVal]) => (
          <div key={`${table}.${field}`} className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              {table} — {field}
              <span className="ml-1 text-[10px] text-slate-400 normal-case font-normal">(date range)</span>
            </label>
            <input
              type="text"
              placeholder={String(defaultVal) || "e.g. 01/01/2025...12/31/2025"}
              value={filters.date_range_fields?.[table]?.[field] ?? ""}
              onChange={(e) => handleDateChange(table, field, e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        ))
      )}
      {Object.entries(filterFields).map(([table, fields]) =>
        Object.entries(fields).map(([field, defaultVal]) => (
          <div key={`${table}.${field}`} className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              {table} — {field}
            </label>
            <input
              type="text"
              placeholder={String(defaultVal) || "Filter value"}
              value={filters.filters?.[table]?.[field] ?? ""}
              onChange={(e) => handleFilterChange(table, field, e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        ))
      )}
    </div>
  );
}

// ── Main Page Content ──────────────────────────────────────────────────────────
function GeneratePageContent({ templateId, slug }: { templateId: string; slug: string }) {
  const { dispatch } = useReport();
  const { addToast } = useToast();
  const { setBreadcrumbs, setBackHref } = useHeader();

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [configJson, setConfigJson] = useState<any>(null);
  const [reportName, setReportName] = useState("");
  const [runtimeFilters, setRuntimeFilters] = useState<Record<string, any>>({});
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [lastReportId, setLastReportId] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    if (!templateId) return;

    const load = async () => {
      setIsPageLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: any }>(
          `/api/templates/${templateId}/config`
        );

        if (!res.success || !res.data) throw new Error("Template not found");

        const { data } = res;
        setTemplateName(data.template_name || "Report");
        setConfigJson(data.config_json);

        // Guard: no config → send back to configurator
        if (!data.has_config) {
          addToast("warning", "Not Configured", "Please configure the report before generating.");
          return;
        }

        // Default report name
        setReportName(
          `${data.template_name || "Report"} — ${new Date().toLocaleDateString("en-US")}`
        );

        // Load into context so ReportPreview can render
        dispatch({
          type: "LOAD_FULL_REPORT",
          payload: {
            config: data.config_json,
            setup: data.setup_json,
            templateId: data.template_id,
            conversationId: null,
          },
        });

        setBreadcrumbs([
          { label: "Templates", href: `/${slug}/templates` },
          { label: data.template_name, href: `/${slug}/templates/${templateId}/setup` },
          { label: "Generate" },
        ]);
        setBackHref(`/${slug}/templates/${templateId}/configurator`);
      } catch (err: any) {
        addToast("error", "Load Error", err.message || "Failed to load template.");
      } finally {
        setIsPageLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // Run the report
  const handleGenerate = useCallback(
    async (saveToHistory = false) => {
      if (saveToHistory) {
        setIsSaving(true);
      } else {
        setIsGenerating(true);
      }

      try {
        const res = await apiClient.post<{ success: boolean; data: any }>(
          `/api/templates/${templateId}/generate`,
          {
            runtime_filters: runtimeFilters,
            report_name: reportName,
            save_to_history: saveToHistory,
          }
        );

        if (!res.success) throw new Error("Generation failed");

        const structuredData = res.data?.report_structure_json;
        setReportData(structuredData);
        dispatch({ type: "SET_REPORT_PREVIEW", payload: structuredData });

        if (saveToHistory) {
          setLastReportId(res.data?.report_id ?? null);
          addToast("success", "Saved", `"${reportName}" saved to report history.`);
        }
      } catch (err: any) {
        addToast("error", "Generation Error", err.message || "Report generation failed.");
      } finally {
        setIsGenerating(false);
        setIsSaving(false);
      }
    },
    [templateId, runtimeFilters, reportName, dispatch, addToast]
  );

  // ── Skeleton ──────────────────────────────────────────────────────────────────
  if (isPageLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-8 animate-pulse space-y-6">
        <div className="h-10 w-64 bg-slate-100 rounded-xl" />
        <div className="h-48 bg-slate-50 rounded-2xl border border-slate-100" />
        <div className="h-[60vh] bg-slate-50 rounded-2xl border border-slate-100" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/${slug}/templates/${templateId}/configurator`}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 transition-colors font-medium"
            >
              <ArrowLeft size={14} />
              Back to Configurator
            </Link>
          </div>
          <h1 className="text-2xl font-black text-slate-900">{templateName}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Set runtime filters and generate your report
          </p>
        </div>
      </div>

      {/* Runtime Filters Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-slate-500" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            Runtime Filters
          </h2>
        </div>
        <div className="p-6 space-y-6">
          {/* Report Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Report Name
            </label>
            <input
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Enter a name for this report run"
            />
          </div>

          {/* Dynamic Filters */}
          <RuntimeFiltersForm
            configJson={configJson}
            filters={runtimeFilters}
            onFiltersChange={setRuntimeFilters}
          />

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              id="run-report-btn"
              onClick={() => handleGenerate(false)}
              disabled={isGenerating || isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-70 hover:opacity-90"
              style={{ background: "#2563eb" }}
            >
              {isGenerating ? (
                <><Loader2 size={15} className="animate-spin" /> Generating…</>
              ) : (
                <><Zap size={15} /> Run Report</>
              )}
            </button>
            <button
              onClick={() => setRuntimeFilters({})}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-all"
            >
              <RotateCcw size={14} />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Report Output */}
      {reportData && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Report Output
            </h2>
            <div className="flex items-center gap-2">
              <button
                id="save-report-btn"
                onClick={() => handleGenerate(true)}
                disabled={isSaving || isGenerating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-70 hover:opacity-90"
                style={{ background: "#059669" }}
              >
                {isSaving ? (
                  <><Loader2 size={14} className="animate-spin" /> Saving…</>
                ) : (
                  <><Save size={14} /> Save to History</>
                )}
              </button>
            </div>
          </div>
          <div className="p-4 bg-gray-50 overflow-auto">
            <ReportPreview />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page Route Component ───────────────────────────────────────────────────────
export default function GeneratePage() {
  const params = useParams();
  const slug = params?.company_slug as string;
  const templateId = params?.template_id as string;

  return (
    <ReportProvider>
      <GeneratePageContent templateId={templateId} slug={slug} />
    </ReportProvider>
  );
}
