'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { FiTrash2, FiMove } from 'react-icons/fi';
import { buildOptions } from '@/app/utils/chartsUtils';
import type { ChartConfig, ChartKind } from '@/lib/charts/ChartTypes';
import * as Highcharts from 'highcharts';
import { CHART_VISUALS, AVAILABLE_CHART_TYPES } from '@/lib/constants/dashboard';
import '@/styles/dashboard.css';

// Dynamically import HighchartsReact to avoid SSR issues
const HighchartsReact = dynamic(
  () => import('highcharts-react-official').then(m => m.default),
  { ssr: false }
);

// Props for ChartCard component
type Props = {
  config: ChartConfig;
  onRemove: (id: string) => void;
  onChangeKind: (id: string, kind: ChartKind) => void;
};

// ChartCard Component
export default function ChartCard({ config, onRemove, onChangeKind }: Props) {
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

  return (
  <div className="card-base flex flex-col h-full w-full">      
      {/*Chart Card Header */}
      <div className="card-header">        
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="dragHandle drag-handle">            
            <FiMove size={16} />
          </div>
          <h3 className="text-sm font-semibold text-slate-700 truncate leading-tight" title={config.title}>
            {config.title}
          </h3>
        </div>

        <div className="flex items-center gap-2 pl-2">
          <select
            className="chart-kind-select"
            value={config.kind}
            onChange={(e) => onChangeKind(config.id, e.target.value as ChartKind)}>
            {AVAILABLE_CHART_TYPES.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1).replace('Column', 'Bar')}
              </option>
            ))}
          </select>

          <button 
            onClick={() => onRemove(config.id)}
            className="delete-btn"
            title="Remove Chart"
          >
            <FiTrash2 size={14} />
          </button>
        </div>
      </div>

     {/*Chart Body */}
      <div className="flex-1 p-2 w-full min-h-100">
        <HighchartsReact 
          highcharts={Highcharts} 
          options={opts} 
          containerProps={{ style: { height: '100%', width: '100%' } }} 
        />
      </div>
    </div>
  );
}