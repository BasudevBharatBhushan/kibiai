'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import * as Highcharts from 'highcharts';
import { BarChart3 } from 'lucide-react';

import { buildOptions } from '@/lib/utils/chartsUtils';
import type { ChartConfig } from '@/lib/charts/ChartTypes';
import type { InsightResult } from '@/lib/insights/types';
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

// Minimal insight renderer that mirrors InsightCard but has no DashboardContext dependency
const CATEGORY_CONFIG: Record<string, { label: string; badgeBg: string; badgeText: string; icon: string }> = {
  trend:       { label: 'Trend',       badgeBg: 'bg-blue-100',   badgeText: 'text-blue-700',   icon: '📈' },
  anomaly:     { label: 'Anomaly',     badgeBg: 'bg-orange-100', badgeText: 'text-orange-700', icon: '⚠️' },
  risk:        { label: 'Risk',        badgeBg: 'bg-red-100',    badgeText: 'text-red-700',    icon: '🔴' },
  opportunity: { label: 'Opportunity', badgeBg: 'bg-green-100',  badgeText: 'text-green-700',  icon: '💡' },
  efficiency:  { label: 'Efficiency',  badgeBg: 'bg-purple-100', badgeText: 'text-purple-700', icon: '⚡' },
  quality:     { label: 'Quality',     badgeBg: 'bg-teal-100',   badgeText: 'text-teal-700',   icon: '✅' },
};
const SEVERITY_CONFIG: Record<string, { dotBg: string; pillBg: string; pillText: string; label: string }> = {
  high:   { dotBg: 'bg-red-500',   pillBg: 'bg-red-50',   pillText: 'text-red-600',   label: 'High'   },
  medium: { dotBg: 'bg-amber-500', pillBg: 'bg-amber-50', pillText: 'text-amber-600', label: 'Medium' },
  low:    { dotBg: 'bg-gray-400',  pillBg: 'bg-gray-50',  pillText: 'text-gray-500',  label: 'Low'    },
};

function InsightList({ results }: { results: InsightResult[] }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      {results.map((insight, idx) => {
        const cat = CATEGORY_CONFIG[insight.category] ?? CATEGORY_CONFIG.trend;
        const sev = SEVERITY_CONFIG[insight.severity] ?? SEVERITY_CONFIG.low;
        return (
          <div key={idx} className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cat.badgeBg} ${cat.badgeText}`}>
                <span className="text-[12px]">{cat.icon}</span>{cat.label}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${sev.pillBg} ${sev.pillText}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${sev.dotBg}`} />
                {sev.label}
              </span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-slate-700">{insight.text}</p>
          </div>
        );
      })}
    </div>
  );
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
        // Tell Highcharts to fill the flex parent — critical for comparison panels
        height: '100%',
        backgroundColor: CHART_VISUALS.BACKGROUND,
        spacingTop: CHART_VISUALS.SPACING.TOP,
        spacingBottom: CHART_VISUALS.SPACING.BOTTOM,
        spacingLeft: CHART_VISUALS.SPACING.LEFT,
        spacingRight: CHART_VISUALS.SPACING.RIGHT,
        reflow: true,
      },
      credits: { enabled: false },
      legend: {
        ...base.legend,
        margin: CHART_VISUALS.LEGEND.MARGIN,
        itemStyle: CHART_VISUALS.LEGEND.ITEM_STYLE,
      },
    };
  }, [config]);

  const hasData =
    config.series.length > 0 &&
    (config.categories.length > 0 ||
      ['pie', 'donut', 'gauge', 'funnel', 'treemap', 'number', 'heatmap'].includes(config.kind));
  const isInsight = config.kind === 'insight';

  return (
    <div className="compare-chart-panel">
      {/* Panel header */}
      <div className="compare-panel-header">
        <div className={`compare-panel-badge compare-panel-badge--${labelColor}`}>
          {sourceMeta?.isTemplate ? '📐' : '📋'} {label}
        </div>
        <p className="compare-panel-name" title={sourceMeta?.report_name}>
          {sourceMeta?.report_name ?? '—'}
        </p>

        {/* Date range + filters */}
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

      {/* Chart body — position:relative lets the absolute child fill exact px height */}
      <div className="compare-panel-chart">
        {isInsight ? (
          /* Insight: inline renderer — no DashboardContext needed */
          <div className="compare-panel-insight-scroll">
            {config.insight_results && config.insight_results.length > 0 ? (
              <InsightList results={config.insight_results as InsightResult[]} />
            ) : (
              <div className="compare-panel-empty">
                <BarChart3 size={32} strokeWidth={1} />
                <p style={{ fontSize: 12, margin: 0 }}>No insight data</p>
              </div>
            )}
          </div>
        ) : !hasData ? (
          <div className="compare-panel-empty">
            <BarChart3 size={32} strokeWidth={1} />
            <p style={{ fontSize: 12, margin: 0 }}>No data available for this chart</p>
          </div>
        ) : (
          /* Absolute-fill wrapper: gives Highcharts a concrete px size to compute height:100% */
          <div className="compare-panel-chart-inner">
            <HighchartsReact
              highcharts={Highcharts}
              options={opts}
              containerProps={{ style: { height: '100%', width: '100%' } }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
