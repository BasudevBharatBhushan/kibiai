'use client';

import React, { useState } from 'react';
import { FiMinus, FiMove } from 'react-icons/fi';
import { useDashboard } from '@/context/DashboardContext';
import { ChartConfig } from '@/lib/charts/ChartTypes';
import type { InsightResult } from '@/lib/insights/types';
import { CardScopeMeta } from './CardScopeMeta';
import { InsightCard as V3InsightCard, InsightCardStyles } from '@/components/insights/InsightCard';
import { InsightDrillDownModal } from '@/components/insights/InsightDrillDownModal';
import '@/styles/dashboard.css';

// Props Type
type Props = {
  config: ChartConfig;
};

// InsightCard Component
export default function InsightCard({ config }: Props) {
  const { removeChart, context } = useDashboard();
  const [selectedInsight, setSelectedInsight] = useState<InsightResult | null>(null);

  // Handle both old string-based insights and new InsightResult objects
  const hasNewInsights = Array.isArray(config.insight_results) && config.insight_results.length > 0;
  
  return (
    <>
      <InsightCardStyles />
      <div className="card-base flex flex-col h-full w-full">      
        <div className="card-header shrink-0 flex items-start justify-between p-3 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="dragHandle drag-handle mt-0.5 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0">
              <FiMove size={16} />
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="text-sm font-semibold text-slate-700 truncate">{config.title || 'Business Insights'}</h3>
              <CardScopeMeta
                dateRange={config.insight_date_range ?? config.report_date_range}
              />
            </div>
          </div>
          <button
            onClick={() => removeChart(config.id)}
            className="delete-btn shrink-0"
            title="Inactivate Insight"
          >
            <FiMinus size={14} />
          </button>
        </div>

        <div className={`flex-1 min-h-0 overflow-y-auto scrollbar-minimal ${hasNewInsights ? '' : 'p-3'}`}>
          <div className="flex flex-col h-full gap-3">
            {hasNewInsights ? (
              config.insight_results!.map((insight: InsightResult, idx: number) => (
                <V3InsightCard
                  key={idx}
                  insight={insight}
                  index={idx}
                  onDrillDown={(ins) => setSelectedInsight(ins)}
                />
              ))
            ) : (
              // Fallback for old string-based insights
              config.insights?.map((text, idx) => {
                const match = text.match(/^(.*?)\s*[-–—]\s*(.*)$/);
                const heading = match ? match[1] : 'Insight';
                const content = match ? match[2] : text;
                return (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <h4 className="text-12 font-bold text-blue-600 mb-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      {heading}
                    </h4>
                    <p className="text-12 text-slate-600 leading-relaxed">
                      {content}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Drill-down modal rendered outside the normal flow to cover screen */}
      {selectedInsight && (
        <InsightDrillDownModal
          insight={selectedInsight}
          context={context}
          onClose={() => setSelectedInsight(null)}
        />
      )}
    </>
  );
}