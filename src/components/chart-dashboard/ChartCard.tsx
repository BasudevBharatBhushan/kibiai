'use client';

import React, { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FiMinus, FiMove, FiGitMerge } from 'react-icons/fi';
import * as Highcharts from 'highcharts';

import { useDashboard } from '@/context/DashboardContext';
import { buildOptions } from '@/lib/utils/chartsUtils';
import type { ChartConfig, ChartKind } from '@/lib/charts/ChartTypes';
import { CHART_VISUALS, AVAILABLE_CHART_TYPES } from '@/constants/dashboard';
import { CardScopeMeta } from './CardScopeMeta';
import CompareModal from './CompareModal';
import '@/styles/dashboard.css';

const HighchartsReact = dynamic(
  () => import('highcharts-react-official').then(m => m.default),
  { ssr: false }
);

// Tracks whether boost has been initialized for this Highcharts instance
let boostInitialized = false;

// Props Type
type Props = {
  config: ChartConfig;
};

export default function ChartCard({ config }: Props) {
  const { removeChart, updateChartKind, isViewerMode } = useDashboard();
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [boostReady, setBoostReady] = useState(boostInitialized);

  // Dynamically import and apply all required Highcharts modules sequentially once per app session
  useEffect(() => {
    if (boostInitialized) {
      if (!boostReady) setBoostReady(true);
      return;
    }

    const loadModules = async () => {
      try {
        const mods = [
          await import('highcharts/modules/boost'),
          await import('highcharts/highcharts-more'),
          await import('highcharts/modules/solid-gauge'),
          await import('highcharts/modules/funnel'),
        ];
        
        for (const mod of mods) {
          const init = (mod as any).default ?? mod;
          if (typeof init === 'function') {
            init(Highcharts);
          }
        }
      } catch (err) {
        console.warn('Failed to load Highcharts modules sequentially:', err);
      } finally {
        boostInitialized = true;
        setBoostReady(true);
      }
    };

    loadModules();
  }, [boostReady]);

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
        itemStyle: CHART_VISUALS.LEGEND.ITEM_STYLE
      }
    };
  }, [config]);

  // Render
  return (
    <div className="card-base flex flex-col h-full w-full">
      <div className="card-header">
        <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
          <div className="dragHandle drag-handle shrink-0">
            <FiMove size={16} />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-sm font-semibold text-slate-700 truncate leading-tight" title={config.title}>
              {config.title}
            </h3>
            <CardScopeMeta
              dateRange={config.report_date_range}
              filters={config.filters}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pl-2 shrink-0">
          {/* Compare button — visible in both admin and viewer modes */}
          <button
            id={`compare-btn-${config.id}`}
            onClick={() => setIsCompareOpen(true)}
            className="compare-btn"
            title="Compare this chart with another report"
          >
            <FiGitMerge size={13} />
            <span className="hidden sm:inline">Compare</span>
          </button>

          {!isViewerMode && (
            <>
              <select
                className="chart-kind-select"
                value={config.kind}
                onChange={(e) => updateChartKind(config.id, e.target.value as ChartKind)}
              >
                {AVAILABLE_CHART_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1).replace('Column', 'Bar')}
                  </option>
                ))}
              </select>

              <button
                onClick={() => removeChart(config.id)}
                className="delete-btn"
                title="Inactivate Chart"
              >
                <FiMinus size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 p-2 w-full min-h-0 overflow-y-auto scrollbar-minimal relative">
        {boostReady && (
          <HighchartsReact
            highcharts={Highcharts}
            options={opts}
            containerProps={{ style: { height: '100%', width: '100%' } }}
          />
        )}
      </div>

      {/* Compare Modal — rendered as a portal */}
      {isCompareOpen && (
        <CompareModal
          primaryConfig={config}
          onClose={() => setIsCompareOpen(false)}
        />
      )}
    </div>
  );
}
