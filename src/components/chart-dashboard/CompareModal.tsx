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

// ── Inline date-range form for "New Filter" ────────────────────────────────────

interface DateRangeEntry {
  table: string;
  field: string;
  start: string;
  end: string;
  label: string;
}

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

  // Extract date-range fields from config
  const dateRangeEntries = useMemo<DateRangeEntry[]>(() => {
    const fields = (templateConfigJson?.date_range_fields ?? null) as Record<
      string,
      Record<string, string>
    > | null;
    if (!fields) return [];

    const setupTables = (templateSetupJson?.tables ?? null) as Record<
      string,
      { fields?: Record<string, { label?: string }> }
    > | null;

    const entries: DateRangeEntry[] = [];
    for (const [table, tableFields] of Object.entries(fields)) {
      for (const [field, rangeStr] of Object.entries(tableFields)) {
        const parts = rangeStr.split('...');
        const defaultStart = parts[0] ?? '';
        const defaultEnd = parts[1] ?? '';
        const label =
          setupTables?.[table]?.fields?.[field]?.label ?? `${table}.${field}`;
        entries.push({ table, field, start: defaultStart, end: defaultEnd, label });
      }
    }
    return entries;
  }, [templateConfigJson, templateSetupJson]);

  const [dateValues, setDateValues] = useState<Record<string, { start: string; end: string }>>(
    () =>
      Object.fromEntries(
        dateRangeEntries.map((e) => [`${e.table}.${e.field}`, { start: e.start, end: e.end }])
      )
  );

  const handleDateChange = useCallback(
    (key: string, part: 'start' | 'end', value: string) => {
      setDateValues((prev) => ({
        ...prev,
        [key]: { ...prev[key], [part]: value },
      }));
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    // Build updated config_json with new date ranges
    const updatedConfigJson: Record<string, unknown> = {
      ...(templateConfigJson ?? {}),
    };

    const updatedDateRangeFields: Record<string, Record<string, string>> = {};
    for (const entry of dateRangeEntries) {
      const key = `${entry.table}.${entry.field}`;
      const { start, end } = dateValues[key] ?? { start: entry.start, end: entry.end };
      if (!updatedDateRangeFields[entry.table]) updatedDateRangeFields[entry.table] = {};
      updatedDateRangeFields[entry.table][entry.field] = `${start}...${end}`;
    }
    updatedConfigJson.date_range_fields = updatedDateRangeFields;

    setIsGenerating(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: { report_id: string } }>(
        '/api/generate-report',
        {
          template_id: templateId,
          config_json: updatedConfigJson,
          setup_json: templateSetupJson,
        }
      );

      if (!res.success || !res.data?.report_id) {
        throw new Error('Report generation did not return a report ID.');
      }
      onSubmit(res.data.report_id);
    } catch (err: unknown) {
      addToast(
        'error',
        'Generation Failed',
        err instanceof Error ? err.message : 'Failed to generate the comparison report.'
      );
      setIsGenerating(false);
    }
  }, [addToast, dateRangeEntries, dateValues, onSubmit, templateConfigJson, templateId, templateSetupJson]);

  return (
    <div className="compare-filter-form">
      <p className="compare-filter-form-heading">Generate with New Filter</p>

      {dateRangeEntries.length === 0 ? (
        <p style={{ fontSize: 12, color: '#64748b' }}>
          No configurable date ranges found for this template.
        </p>
      ) : (
        dateRangeEntries.map((entry) => {
          const key = `${entry.table}.${entry.field}`;
          const values = dateValues[key] ?? { start: entry.start, end: entry.end };
          return (
            <div key={key}>
              <p
                className="compare-filter-form-label"
                style={{ marginBottom: 8 }}
              >
                {entry.label}
              </p>
              <div className="compare-filter-form-group">
                <label className="compare-filter-form-label">Start Date</label>
                <input
                  type="date"
                  className="compare-filter-form-input"
                  value={values.start}
                  onChange={(e) => handleDateChange(key, 'start', e.target.value)}
                />
              </div>
              <div className="compare-filter-form-group" style={{ marginTop: 8 }}>
                <label className="compare-filter-form-label">End Date</label>
                <input
                  type="date"
                  className="compare-filter-form-input"
                  value={values.end}
                  onChange={(e) => handleDateChange(key, 'end', e.target.value)}
                />
              </div>
            </div>
          );
        })
      )}

      <div className="compare-filter-form-actions">
        <button
          onClick={handleSubmit}
          disabled={isGenerating}
          className="compare-filter-submit-btn"
        >
          {isGenerating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Generating…
            </>
          ) : (
            'Generate Report'
          )}
        </button>
        <button onClick={onCancel} className="compare-filter-cancel-btn" disabled={isGenerating}>
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
          // Fetch from the reports endpoint if we have a report_id
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

  // ── Primary chart: re-process from primary dataset using the same schema ──
  // (The config passed in from ChartCard is already processed — use as-is for the left panel)
  const leftConfig = primaryConfig;

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
            config={leftConfig}
            sourceMeta={
              resolvedPrimaryMeta ?? {
                report_name: isViewerMode ? 'Current Report' : 'Template Preview',
                isTemplate: !isViewerMode,
              }
            }
            label={isViewerMode ? 'Primary' : 'Template'}
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
