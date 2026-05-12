'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import * as Highcharts from 'highcharts';
import { BarChart3 } from 'lucide-react';

import { buildOptions } from '@/lib/utils/chartsUtils';
import type { ChartConfig } from '@/lib/charts/ChartTypes';
import { CHART_VISUALS } from '@/constants/dashboard';
import { CardScopeMeta } from './CardScopeMeta';
import '@/styles/dashboard.css';

const HighchartsReact = dynamic(
  () => import('highcharts-react-official').then((m) => m.default),
  { ssr: false }
);

// Shared interface for metadata on either side of the comparison
export interface ComparePanelSourceMeta {
  report_id?: string;
  report_name: string;
  report_template_id?: string;
  created_on?: string;
  /** Used for admin mode — identifies this as a template (not a saved report) */
  isTemplate?: boolean;
}

interface CompareChartPanelProps {
  config: ChartConfig;
  sourceMeta: ComparePanelSourceMeta | null;
  /** Display label e.g. "Primary" or "Comparison" */
  label: string;
  /** Badge colour */
  labelColor: 'blue' | 'purple' | 'emerald';
}

export default function CompareChartPanel({
  config,
  sourceMeta,
  label,
  labelColor,
}: CompareChartPanelProps) {
  const opts = useMemo(() => {
    const base = buildOptions(config);
    return {
      ...base,
      title: { text: undefined },
      chart: {
        ...base.chart,
        backgroundColor: CHART_VISUALS.BACKGROUND,
        spacingTop: CHART_VISUALS.SPACING.TOP,
        spacingBottom: CHART_VISUALS.SPACING.BOTTOM,
        spacingLeft: CHART_VISUALS.SPACING.LEFT,
        spacingRight: CHART_VISUALS.SPACING.RIGHT,
      },
      credits: { enabled: false },
      legend: {
        ...base.legend,
        margin: CHART_VISUALS.LEGEND.MARGIN,
        itemStyle: CHART_VISUALS.LEGEND.ITEM_STYLE,
      },
    };
  }, [config]);

  const hasData = config.series.length > 0 && config.categories.length > 0;
  const isInsight = config.kind === 'insight';

  return (
    <div className="compare-chart-panel">
      {/* Panel header */}
      <div className="compare-panel-header">
        <div className={`compare-panel-badge compare-panel-badge--${labelColor}`}>
          {sourceMeta?.isTemplate ? '📐 Template' : '📋'} {label}
        </div>
        <p className="compare-panel-name" title={sourceMeta?.report_name}>
          {sourceMeta?.report_name ?? '—'}
        </p>

        {/* Date range + filters (reuse existing CardScopeMeta) */}
        <CardScopeMeta
          dateRange={config.report_date_range}
          filters={config.filters}
        />

        {sourceMeta?.created_on && (
          <p className="compare-panel-date">
            Generated: {new Date(sourceMeta.created_on).toLocaleString()}
          </p>
        )}
        {sourceMeta?.isTemplate && (
          <p className="compare-panel-date">Template preview data</p>
        )}
      </div>

      {/* Chart body */}
      <div className="compare-panel-chart">
        {isInsight ? (
          /* Insight cards: render text results */
          <div className="compare-panel-empty" style={{ justifyContent: 'flex-start', padding: 16 }}>
            {config.insight_results && config.insight_results.length > 0 ? (
              <ul style={{ width: '100%', listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {config.insight_results.map((r, i) => (
                  <li
                    key={i}
                    style={{
                      background: '#f8fafc',
                      borderRadius: 10,
                      padding: '10px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#334155',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <span style={{ color: '#64748b', fontWeight: 500, marginRight: 6 }}>
                      {r.label ?? ''}:
                    </span>
                    {String(r.value ?? '—')}
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <BarChart3 size={32} strokeWidth={1} />
                <p style={{ fontSize: 12, margin: 0 }}>No insight data</p>
              </>
            )}
          </div>
        ) : !hasData ? (
          <div className="compare-panel-empty">
            <BarChart3 size={32} strokeWidth={1} />
            <p style={{ fontSize: 12, margin: 0 }}>No data available for this chart</p>
          </div>
        ) : (
          <HighchartsReact
            highcharts={Highcharts}
            options={opts}
            containerProps={{ style: { height: '100%', width: '100%' } }}
          />
        )}
      </div>
    </div>
  );
}
