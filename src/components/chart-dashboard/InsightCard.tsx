'use client';

import React from 'react';
import { FiTrash2, FiMove } from 'react-icons/fi';
import { ChartConfig } from '@/lib/charts/ChartTypes';
import { INSIGHT_CONFIG } from '@/lib/constants/analytics';
import '@/styles/dashboard.css';

// Props for InsightCard component
type Props = {
  config: ChartConfig;
  onRemove: (id: string) => void;
};

// InsightCard Component
export default function InsightCard({ config, onRemove }: Props) {
  return (
    <div className="card-base flex flex-col h-full w-full">      
      {/* Header */}
      <div className="card-header shrink-0">
        <div className="flex items-center gap-3">
          <div className="dragHandle drag-handle">
            <FiMove size={16} />
          </div>
          <h3 className="text-36 font-semibold text-slate-700">{config.title}</h3>
        </div>
        <button 
          onClick={() => onRemove(config.id)}
          className="delete-btn"
        >
          <FiTrash2 size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col gap-3">
          {config.insights?.map((text, idx) => {
            const [heading, ...rest] = text.split(INSIGHT_CONFIG.SEPARATOR);
            const content = rest.join(INSIGHT_CONFIG.SEPARATOR);
            return (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                <h4 className="text-12 font-bold text-blue-600 mb-1 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${INSIGHT_CONFIG.BULLET_COLOR}`}></span>
                  {content ? heading : 'Insight'}
                </h4>
                <p className="text-12 text-slate-600 leading-relaxed">
                  {content || heading}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}