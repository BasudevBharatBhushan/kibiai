'use client';

import React from 'react';
import { FileText, ChevronRight, Plus, Inbox } from 'lucide-react';
import '@/styles/dashboard.css';

export interface ReportListItem {
  report_id: string;
  report_name: string;
  created_on: string;
  report_template_id: string;
  report_config_json?: Record<string, unknown> | null;
}

interface ReportHistoryPickerProps {
  reports: ReportListItem[];
  isLoading: boolean;
  /** ID of the currently-viewed report (to exclude from the list) */
  currentReportId?: string;
  onSelectReport: (report: ReportListItem) => void;
  onNewFilter: () => void;
}

function PickerSkeleton() {
  return (
    <div className="compare-loading-skeleton">
      <div className="compare-skeleton-bar" style={{ height: 52 }} />
      <div className="compare-skeleton-bar" style={{ height: 52 }} />
      <div className="compare-skeleton-bar" style={{ height: 52 }} />
    </div>
  );
}

export default function ReportHistoryPicker({
  reports,
  isLoading,
  currentReportId,
  onSelectReport,
  onNewFilter,
}: ReportHistoryPickerProps) {
  const filteredReports = reports.filter((r) => r.report_id !== currentReportId);

  return (
    <div className="compare-picker">
      <p className="compare-picker-heading">Select a comparison source</p>
      <p className="compare-picker-sub">
        Compare against a saved report, or generate a new one with different filters.
      </p>

      {/* List */}
      {isLoading ? (
        <PickerSkeleton />
      ) : filteredReports.length === 0 ? (
        <div
          className="compare-picker-list"
          style={{ alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}
        >
          <Inbox size={32} strokeWidth={1.25} style={{ marginBottom: 8 }} />
          <p style={{ fontSize: 12, margin: 0, fontWeight: 500 }}>No other saved reports</p>
          <p style={{ fontSize: 11, margin: '4px 0 0', color: '#cbd5e1' }}>
            Generate a new report below.
          </p>
        </div>
      ) : (
        <div className="compare-picker-list">
          {filteredReports.map((r) => (
            <button
              key={r.report_id}
              onClick={() => onSelectReport(r)}
              className="compare-picker-item"
              title={r.report_name}
            >
              <FileText
                size={16}
                strokeWidth={1.5}
                style={{ color: '#64748b', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="compare-picker-item-name">{r.report_name}</p>
                <p className="compare-picker-item-date">
                  {new Date(r.created_on).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <ChevronRight
                size={14}
                strokeWidth={2}
                style={{ color: '#cbd5e1', flexShrink: 0 }}
              />
            </button>
          ))}
        </div>
      )}

      {/* New Filter CTA */}
      <div className="compare-picker-footer">
        <button
          onClick={onNewFilter}
          className="compare-new-filter-btn"
          title="Generate a new report with custom filters for comparison"
        >
          <Plus size={14} strokeWidth={2.5} />
          Generate with New Filter
        </button>
      </div>
    </div>
  );
}
