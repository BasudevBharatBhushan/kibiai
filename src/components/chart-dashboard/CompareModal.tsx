'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GitMerge, X, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useParams } from 'next/navigation';

import { useDashboard } from '@/context/DashboardContext';
import { useToast } from '@/context/ToastContext';
import { processData } from '@/lib/charts/DataProcessor';
import { buildInsightContextFromReportConfig } from '@/lib/charts/insightContextBuilder';
import type { ChartConfig, ReportChartSchema, InsightContext } from '@/lib/charts/ChartTypes';
import { COLOR_PALETTES } from '@/lib/charts/ChartTypes';
import { apiClient } from '@/utils/apiClient';

import CompareChartPanel, { type ComparePanelSourceMeta } from './CompareChartPanel';
import ReportHistoryPicker, { type ReportListItem } from './ReportHistoryPicker';
import '@/styles/dashboard.css';

// ── Types ──────────────────────────────────────────────────────────────────────

type RightPanelState = 'PICKING' | 'LOADING' | 'VIEWING' | 'NEW_FILTER' | 'GENERATING';

interface CompareReportPayload {
  report_id: string;
  report_name: string;
  report_template_id: string;
  created_on: string;
  report_config_json: Record<string, unknown> | null;
  report_template_config_json: Record<string, unknown> | null;
  report_template_setup_json: Record<string, unknown> | null;
  rows: Array<Record<string, unknown>>;
  schemas: ReportChartSchema[];
}

interface TemplatePayload {
  template_id: string;
  template_name: string;
  report_template_config_json: Record<string, unknown> | null;
  report_template_setup_json: Record<string, unknown> | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Extract all date-range entries from config, resolved against setup labels */
function extractDateRangeEntries(
  configJson: Record<string, unknown> | null,
  setupJson: Record<string, unknown> | null
) {
  const fields = (configJson?.date_range_fields ?? null) as Record<
    string,
    Record<string, string>
  > | null;
  if (!fields) return [];

  const setupTables = (setupJson?.tables ?? null) as Record<
    string,
    { fields?: Record<string, { label?: string }> }
  > | null;

  const entries: { table: string; field: string; start: string; end: string; label: string }[] = [];
  for (const [table, tableFields] of Object.entries(fields)) {
    for (const [field, rangeStr] of Object.entries(tableFields)) {
      const parts = rangeStr.split('...');
      entries.push({
        table,
        field,
        start: parts[0] ?? '',
        end: parts[1] ?? '',
        label: setupTables?.[table]?.fields?.[field]?.label ?? `${table} — ${field}`,
      });
    }
  }
  return entries;
}

/** Extract all non-date filter entries from config */
function extractFilterEntries(
  configJson: Record<string, unknown> | null,
  setupJson: Record<string, unknown> | null
) {
  const filterMap = (configJson?.filters ?? null) as Record<
    string,
    Record<string, unknown>
  > | null;
  if (!filterMap) return [];

  const setupTables = (setupJson?.tables ?? null) as Record<
    string,
    { fields?: Record<string, { label?: string }> }
  > | null;

  const entries: { table: string; field: string; value: string; label: string }[] = [];
  for (const [table, tableFields] of Object.entries(filterMap)) {
    for (const [field, val] of Object.entries(tableFields)) {
      entries.push({
        table,
        field,
        value: val !== undefined && val !== null ? String(val) : '',
        label: setupTables?.[table]?.fields?.[field]?.label ?? `${table} — ${field}`,
      });
    }
  }
  return entries;
}

function toIsoDateLocal(dStr: string): string {
  if (!dStr) return '';
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return dStr;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

import { AdHocFilterBuilder, AdHocDateRangeBuilder, CollapsibleSection, type AdHocFilter, type AdHocDateRange, parseSavedFilterValue } from "@/components/report-configurator/ReportFiltersUI";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { Plus, SlidersHorizontal, Clock, RefreshCw } from "lucide-react";

function InlineReportFilterForm({
  templateId,
  templateConfigJson,
  templateSetupJson,
  onSubmit,
  onCancel,
}: {
  templateId: string;
  templateConfigJson: Record<string, unknown> | null;
  templateSetupJson: Record<string, unknown> | null;
  onSubmit: (reportId: string) => void;
  onCancel: () => void;
}) {
  const { addToast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Available Fields ──
  const availableFields = useMemo<{ table: string; field: string; label: string; type: string }[]>(() => {
    if (!templateConfigJson || !templateSetupJson) return [];
    
    const fieldMap = new Map<string, { table: string; field: string; label: string; type: string }>();

    // 1. Fields from Columns
    const columns = (templateConfigJson.report_columns as any[]) || [];
    columns.forEach((col) => {
      if (!col.table || !col.field || col.table === "calculated") return;
      const key = `${col.table}.${col.field}`;
      if (!fieldMap.has(key)) {
        const fieldDef = (templateSetupJson.tables as any)?.[col.table]?.fields?.[col.field];
        fieldMap.set(key, { 
          table: col.table, 
          field: col.field, 
          label: fieldDef?.label || col.field, 
          type: fieldDef?.type || "text" 
        });
      }
    });

    // 2. Fields from Grouping
    const groups = (templateConfigJson.group_by_fields as Record<string, any>) || {};
    Object.values(groups).forEach((group) => {
      if (!group.table || !group.field) return;
      const key = `${group.table}.${group.field}`;
      if (!fieldMap.has(key)) {
        const fieldDef = (templateSetupJson.tables as any)?.[group.table]?.fields?.[group.field];
        fieldMap.set(key, { 
          table: group.table, 
          field: group.field, 
          label: fieldDef?.label || group.field, 
          type: fieldDef?.type || "text" 
        });
      }
    });

    return Array.from(fieldMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [templateConfigJson, templateSetupJson]);

  // ── State ──
  const [dateRanges, setDateRanges] = useState<Record<string, Record<string, { from: string; to: string }>>>({});
  const [adHocDateRanges, setAdHocDateRanges] = useState<AdHocDateRange[]>([]);
  
  const [configFilters, setConfigFilters] = useState<Record<string, Record<string, string>>>({});
  const [adHocFilters, setAdHocFilters] = useState<AdHocFilter[]>([]);

  // ── Template Base Fields ──
  const dateRangeFields: Record<string, Record<string, string>> = (templateConfigJson?.date_range_fields as any) || {};
  const filterFields: Record<string, Record<string, any>> = (templateConfigJson?.filters as any) || {};

  // ── Submit → POST /api/templates/[id]/generate ──
  const handleSubmit = useCallback(async () => {
    const payload: any = {};

    const drPayload: any = {};
    Object.entries(dateRanges).forEach(([table, fields]) => {
      Object.entries(fields).forEach(([field, { from, to }]) => {
        if (from && to) {
          if (!drPayload[table]) drPayload[table] = {};
          drPayload[table][field] = `${from}...${to}`;
        }
      });
    });

    adHocDateRanges.forEach(r => {
      if (r.table && r.field && r.from && r.to) {
        if (!drPayload[r.table]) drPayload[r.table] = {};
        drPayload[r.table][r.field] = `${r.from}...${r.to}`;
      }
    });

    if (Object.keys(drPayload).length) payload.date_range_fields = drPayload;

    const cfPayload: any = {};
    Object.entries(configFilters).forEach(([table, fields]) => {
      Object.entries(fields).forEach(([field, val]) => {
        if (val) { if (!cfPayload[table]) cfPayload[table] = {}; cfPayload[table][field] = val; }
      });
    });

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

    setIsGenerating(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: { report_id: string } }>(
        `/api/templates/${templateId}/generate`,
        { runtime_filters: payload }
      );

      if (!res.success || !res.data?.report_id) {
        throw new Error((res as any).error ?? 'Report generation did not return a report ID.');
      }
      onSubmit(res.data.report_id);
    } catch (err: unknown) {
      addToast(
        'error',
        'Generation Failed',
        err instanceof Error ? err.message : 'Failed to generate the comparison report.'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [dateRanges, adHocDateRanges, configFilters, adHocFilters, templateId, onSubmit, addToast]);

  return (
    <div className="flex flex-col space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="flex justify-between items-center mb-2">
        <p className="compare-filter-form-heading m-0">Generate with New Filter</p>
        <button
          onClick={() => { 
            setDateRanges({}); 
            setConfigFilters({}); 
            setAdHocFilters([]); 
            setAdHocDateRanges([]);
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Reset filters"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Date Ranges */}
      {(Object.keys(dateRangeFields).length > 0 || availableFields.some(f => f.type === "date")) && (
        <CollapsibleSection title="Date Ranges" icon={<Clock size={13} />}>
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

      {/* Ad-hoc Filters */}
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

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSubmit}
          disabled={isGenerating}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 hover:opacity-90"
          style={{ background: "#2563eb" }}
        >
          {isGenerating ? (
            <><Loader2 size={14} className="animate-spin" /> Generating…</>
          ) : (
            'Generate Report'
          )}
        </button>
        <button 
          onClick={onCancel} 
          disabled={isGenerating}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Loading / Generating skeletons ─────────────────────────────────────────────

function LoadingSkeleton({ message }: { message: string }) {
  return (
    <div className="compare-loading-skeleton" style={{ alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Loader2 size={28} strokeWidth={1.5} style={{ color: '#2563eb' }} className="animate-spin" />
      <p style={{ fontSize: 13, color: '#64748b', margin: 0, fontWeight: 500 }}>{message}</p>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

interface CompareModalProps {
  /** The chart card that triggered the comparison */
  primaryConfig: ChartConfig;
  /** The primaryConfig's source meta if the parent already has it (user viewer) */
  primarySourceMeta?: ComparePanelSourceMeta;
  onClose: () => void;
}

export default function CompareModal({
  primaryConfig,
  primarySourceMeta,
  onClose,
}: CompareModalProps) {
  const params = useParams();
  const { templateId, isViewerMode, dataset: primaryDataset } = useDashboard();
  const { addToast } = useToast();

  // Current report id from URL (user viewer mode only)
  const reportId = params?.report_id as string | undefined;

  // ── State ──
  const [rightPanelState, setRightPanelState] = useState<RightPanelState>('PICKING');
  const [availableReports, setAvailableReports] = useState<ReportListItem[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);

  // Left panel (primary) meta — used when CompareModal doesn't receive it from parent
  const [resolvedPrimaryMeta, setResolvedPrimaryMeta] = useState<ComparePanelSourceMeta | null>(
    primarySourceMeta ?? null
  );

  // Template config/setup for the InlineReportFilterForm
  const [templateConfigJson, setTemplateConfigJson] = useState<Record<string, unknown> | null>(null);
  const [templateSetupJson, setTemplateSetupJson] = useState<Record<string, unknown> | null>(null);

  // Right panel (comparison)
  const [comparisonChartConfig, setComparisonChartConfig] = useState<ChartConfig | null>(null);
  const [comparisonSourceMeta, setComparisonSourceMeta] = useState<ComparePanelSourceMeta | null>(null);

  // Error state for right panel
  const [rightPanelError, setRightPanelError] = useState<string | null>(null);

  const hasFetchedRef = useRef(false);

  // ── ESC key handler ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // ── On mount: resolve primary meta + fetch available reports ──
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const init = async () => {
      if (!templateId) return;

      try {
        // 1. Resolve primary meta (if not provided by parent)
        if (!primarySourceMeta) {
          if (isViewerMode && reportId) {
            // User mode: fetch the current report for its name/config
            const res = await apiClient.get<{
              success: boolean;
              data: {
                report_id: string;
                report_name: string;
                report_template_id: string;
                created_on: string;
                report_config_json: Record<string, unknown> | null;
                report_template_config_json: Record<string, unknown> | null;
                report_template_setup_json: Record<string, unknown> | null;
              };
            }>(`/api/reports/${reportId}`);

            if (res.success && res.data) {
              setResolvedPrimaryMeta({
                report_id: res.data.report_id,
                report_name: res.data.report_name,
                report_template_id: res.data.report_template_id,
                created_on: res.data.created_on,
              });
              setTemplateConfigJson(res.data.report_template_config_json);
              setTemplateSetupJson(res.data.report_template_setup_json);
            }
          } else {
            // Admin mode: fetch template for its name/config
            const res = await apiClient.get<{
              success: boolean;
              data: TemplatePayload;
            }>(`/api/report-templates/${templateId}/charts`);

            if (res.success && res.data) {
              setResolvedPrimaryMeta({
                report_name: res.data.template_name,
                report_template_id: res.data.template_id,
                isTemplate: true,
              });
              setTemplateConfigJson(res.data.report_template_config_json);
              setTemplateSetupJson(res.data.report_template_setup_json);
            }
          }
        } else {
          // primarySourceMeta already provided; still need template config for new filter form
          if (primarySourceMeta.report_id) {
            const res = await apiClient.get<{
              success: boolean;
              data: {
                report_template_config_json: Record<string, unknown> | null;
                report_template_setup_json: Record<string, unknown> | null;
              };
            }>(`/api/reports/${primarySourceMeta.report_id}`);
            if (res.success && res.data) {
              setTemplateConfigJson(res.data.report_template_config_json);
              setTemplateSetupJson(res.data.report_template_setup_json);
            }
          }
        }

        // 2. Fetch available reports for the same template
        const listRes = await apiClient.get<{ success: boolean; data: ReportListItem[] }>(
          `/api/reports?template_id=${templateId}&limit=50`
        );
        if (listRes.success && listRes.data) {
          setAvailableReports(listRes.data);
        }
      } catch (err: unknown) {
        addToast(
          'error',
          'Load Error',
          err instanceof Error ? err.message : 'Failed to load comparison data.'
        );
      } finally {
        setIsLoadingReports(false);
      }
    };

    init();
  }, [addToast, isViewerMode, primarySourceMeta, reportId, templateId]);

  // ── Build primary InsightContext from the primaryConfig's date range ──
  const primaryInsightContext = useMemo<InsightContext | undefined>(() => {
    if (primaryConfig.report_date_range?.start) {
      return {
        reportStart: primaryConfig.report_date_range.start,
        reportEnd: primaryConfig.report_date_range.end,
        reportDateField: primaryConfig.report_date_range.field,
      };
    }
    return undefined;
  }, [primaryConfig]);

  // ── Handle: user picks a report from the history list ──
  const handleSelectReport = useCallback(
    async (report: ReportListItem) => {
      setRightPanelState('LOADING');
      setRightPanelError(null);

      try {
        const res = await apiClient.get<{ success: boolean; data: CompareReportPayload }>(
          `/api/reports/${report.report_id}`
        );

        if (!res.success || !res.data) throw new Error('Could not fetch the selected report.');

        const { rows, schemas, report_config_json, report_template_setup_json, report_template_config_json } = res.data;

        // Find the matching schema by pKey === primaryConfig.id
        const matchingSchema = schemas.find((s) => s.pKey === primaryConfig.id);
        if (!matchingSchema) {
          setRightPanelError(
            'This chart is not available in the selected report. The chart template may have been added after that report was generated.'
          );
          setRightPanelState('VIEWING');
          return;
        }

        // Build the insight context from the selected report's config
        const comparisonInsightCtx = buildInsightContextFromReportConfig(
          report_config_json,
          report_template_setup_json ?? report_template_config_json
        );

        const processed = processData(rows as never[], [matchingSchema], comparisonInsightCtx);
        const chartConfig = processed[0];

        if (!chartConfig) {
          setRightPanelError('No data available for this chart in the selected report.');
          setRightPanelState('VIEWING');
          return;
        }

        // Assign matching colors from primary chart or fall back to standard palette
        chartConfig.colors = primaryConfig.colors || COLOR_PALETTES[0];

        setComparisonChartConfig(chartConfig);
        setComparisonSourceMeta({
          report_id: res.data.report_id,
          report_name: res.data.report_name,
          report_template_id: res.data.report_template_id,
          created_on: res.data.created_on,
        });
        setRightPanelState('VIEWING');
      } catch (err: unknown) {
        addToast(
          'error',
          'Comparison Failed',
          err instanceof Error ? err.message : 'Failed to load the comparison report.'
        );
        setRightPanelState('PICKING');
      }
    },
    [addToast, primaryConfig.id]
  );

  // ── Handle: new report generated from InlineReportFilterForm ──
  const handleNewReportGenerated = useCallback(
    async (newReportId: string) => {
      setRightPanelState('GENERATING');
      // Treat the new report the same as selecting from history
      await handleSelectReport({ report_id: newReportId } as ReportListItem);
      // Refresh the available reports list
      if (templateId) {
        try {
          const listRes = await apiClient.get<{ success: boolean; data: ReportListItem[] }>(
            `/api/reports?template_id=${templateId}&limit=50`
          );
          if (listRes.success && listRes.data) setAvailableReports(listRes.data);
        } catch { /* non-critical */ }
      }
    },
    [handleSelectReport, templateId]
  );

  // ── Labels ──
  // User mode: "Current Report" / "Comparison"
  // Admin mode: "Current Template" / "Comparison"
  const leftLabel = isViewerMode ? 'Current Report' : 'Current Template';
  const leftFallbackName = isViewerMode ? 'Current Report' : 'Template Preview';

  // ── Render ──
  const modalContent = (
    <div
      className="compare-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Chart Comparison: ${primaryConfig.title}`}
    >
      <div
        className="compare-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="compare-modal-header">
          <GitMerge size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
          <span className="compare-modal-title" title={`Chart Comparison — ${primaryConfig.title}`}>
            Chart Comparison — {primaryConfig.title}
          </span>
          <button
            className="compare-modal-close-btn"
            onClick={onClose}
            aria-label="Close comparison"
          >
            <X size={15} />
          </button>
        </div>

        {/* Split Body */}
        <div className="compare-modal-body">
          {/* ── LEFT: Primary ── */}
          <CompareChartPanel
            config={primaryConfig}
            sourceMeta={
              resolvedPrimaryMeta ?? {
                report_name: leftFallbackName,
                isTemplate: !isViewerMode,
              }
            }
            label={leftLabel}
            labelColor="blue"
          />

          {/* ── VS Divider ── */}
          <div className="compare-divider">
            <span className="compare-divider-label">VS</span>
          </div>

          {/* ── RIGHT: Comparison ── */}
          <div className="compare-right-panel">
            {rightPanelState === 'PICKING' && (
              <ReportHistoryPicker
                reports={availableReports}
                isLoading={isLoadingReports}
                currentReportId={reportId}
                templateSetupJson={templateSetupJson}
                onSelectReport={handleSelectReport}
                onNewFilter={() => setRightPanelState('NEW_FILTER')}
              />
            )}

            {rightPanelState === 'LOADING' && (
              <LoadingSkeleton message="Loading comparison report…" />
            )}

            {rightPanelState === 'GENERATING' && (
              <LoadingSkeleton message="Generating new report…" />
            )}

            {rightPanelState === 'NEW_FILTER' && (
              <InlineReportFilterForm
                templateId={templateId ?? ''}
                templateConfigJson={templateConfigJson}
                templateSetupJson={templateSetupJson}
                onSubmit={handleNewReportGenerated}
                onCancel={() => setRightPanelState('PICKING')}
              />
            )}

            {rightPanelState === 'VIEWING' && rightPanelError && (
              <div className="compare-panel-empty" style={{ padding: 32 }}>
                <AlertTriangle
                  size={32}
                  strokeWidth={1.5}
                  style={{ color: '#f59e0b' }}
                />
                <p style={{ fontSize: 13, fontWeight: 600, color: '#78350f', margin: 0 }}>
                  Comparison Not Available
                </p>
                <p style={{ fontSize: 12, color: '#92400e', marginTop: 4, textAlign: 'center' }}>
                  {rightPanelError}
                </p>
                <button
                  onClick={() => {
                    setRightPanelError(null);
                    setRightPanelState('PICKING');
                  }}
                  style={{
                    marginTop: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: '#2563eb',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  <ArrowLeft size={13} />
                  Pick another report
                </button>
              </div>
            )}

            {rightPanelState === 'VIEWING' && !rightPanelError && comparisonChartConfig && (
              <CompareChartPanel
                config={comparisonChartConfig}
                sourceMeta={comparisonSourceMeta}
                label="Comparison"
                labelColor="purple"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render as a portal so it escapes any overflow/z-index stacking contexts
  if (typeof window === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
