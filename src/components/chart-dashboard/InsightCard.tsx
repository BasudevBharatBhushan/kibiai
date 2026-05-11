'use client';

import React from 'react';
import { FiMinus, FiMove } from 'react-icons/fi';
import { useDashboard } from '@/context/DashboardContext';
import { ChartConfig } from '@/lib/charts/ChartTypes';
import type { InsightResult, InsightCategory, InsightSeverity } from '@/lib/insights/types';
import { CardScopeMeta } from './CardScopeMeta';
import '@/styles/dashboard.css';

// Props Type
type Props = {
  config: ChartConfig;
};

// ─── Category Config ─────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<InsightCategory, { label: string; badgeBg: string; badgeText: string; icon: string }> = {
  trend:       { label: "Trend",       badgeBg: "bg-blue-100",   badgeText: "text-blue-700",   icon: "📈" },
  anomaly:     { label: "Anomaly",     badgeBg: "bg-orange-100", badgeText: "text-orange-700", icon: "⚠️" },
  risk:        { label: "Risk",        badgeBg: "bg-red-100",    badgeText: "text-red-700",    icon: "🔴" },
  opportunity: { label: "Opportunity", badgeBg: "bg-green-100",  badgeText: "text-green-700",  icon: "💡" },
  efficiency:  { label: "Efficiency",  badgeBg: "bg-purple-100", badgeText: "text-purple-700", icon: "⚡" },
  quality:     { label: "Quality",     badgeBg: "bg-teal-100",   badgeText: "text-teal-700",   icon: "✅" },
};

// ─── Severity Config ──────────────────────────────────────────────────────────
const SEVERITY_CONFIG: Record<InsightSeverity, { dotBg: string; label: string; pillBg: string; pillText: string }> = {
  high:   { dotBg: "bg-red-500",   label: "High",   pillBg: "bg-red-50",   pillText: "text-red-600"   },
  medium: { dotBg: "bg-amber-500", label: "Medium", pillBg: "bg-amber-50", pillText: "text-amber-600" },
  low:    { dotBg: "bg-gray-400",  label: "Low",    pillBg: "bg-gray-50",  pillText: "text-gray-500"  },
};

// InsightCard Component
export default function InsightCard({ config }: Props) {
  const { removeChart } = useDashboard();

  // Handle both old string-based insights and new InsightResult objects
  const hasNewInsights = Array.isArray(config.insight_results) && config.insight_results.length > 0;
  
  return (
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

      <div className="flex-1 min-h-0 p-3 overflow-y-auto scrollbar-minimal">
        <div className="flex flex-col gap-3">
          {hasNewInsights ? (
            config.insight_results!.map((insight: InsightResult, idx: number) => {
              const category = CATEGORY_CONFIG[insight.category] ?? CATEGORY_CONFIG.trend;
              const severity = SEVERITY_CONFIG[insight.severity] ?? SEVERITY_CONFIG.low;
              
              return (
                <div key={idx} className="group rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${category.badgeBg} ${category.badgeText}`}>
                      <span className="text-[12px]">{category.icon}</span>
                      {category.label}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${severity.pillBg} ${severity.pillText}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${severity.dotBg}`} />
                      {severity.label}
                    </span>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-slate-700">
                    {insight.text}
                  </p>
                </div>
              );
            })
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
  );
}