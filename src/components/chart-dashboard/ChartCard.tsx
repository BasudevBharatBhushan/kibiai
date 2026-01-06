'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { FiTrash2, FiMove } from 'react-icons/fi';
import { buildOptions } from '@/lib/utils/charts-utils';
import type { ChartConfig, ChartKind } from '@/lib/ChartTypes';
import * as Highcharts from 'highcharts';
import '@/styles/dashboard.css';

const HighchartsReact = dynamic(
  () => import('highcharts-react-official').then(m => m.default),
  { ssr: false }
);

type Props = {
  config: ChartConfig;
  onRemove: (id: string) => void;
  onChangeKind: (id: string, kind: ChartKind) => void;
};

export default function ChartCard({ config, onRemove, onChangeKind }: Props) {
  const opts = useMemo(() => {
    const base = buildOptions(config);
    return {
      ...base,
      title: { text: undefined }, 
      chart: { 
        ...base.chart, 
        backgroundColor: 'transparent',
        spacingTop: 10,
        spacingBottom: 5,
        spacingLeft: 5,
        spacingRight: 5,
    },
      credits: { enabled: false },
      legend: {
        ...base.legend,
        margin: 5, 
        itemStyle: { fontSize: '11px', color: '#64748b' } 
      }
    };
  }, [config]);

  return (
  <div className="card-base flex flex-col h-full w-full">      
    
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
            onChange={(e) => onChangeKind(config.id, e.target.value as ChartKind)}
          >
            <option value="line">Line</option>
            <option value="column">Bar</option>
            <option value="area">Area</option>
            <option value="pie">Pie</option>
            <option value="donut">Donut</option>
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