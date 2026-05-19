"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import type {
  InsightResult,
  InsightCategory,
  InsightSeverity,
} from "@/lib/insights/types";
import { isInsightResult } from "@/lib/insights/types";


interface InsightCardProps {
  insight: InsightResult;
  /** Used for staggered animation delay */
  index: number;
  /** v3 only: called when "Drill Down" is clicked */
  onDrillDown?: (insight: InsightResult) => void;
}

// ─── Category Config ─────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  InsightCategory,
  { label: string; badgeBg: string; badgeText: string; icon: string }
> = {
  trend:       { label: "Trend",       badgeBg: "bg-blue-100",   badgeText: "text-blue-700",   icon: "📈" },
  anomaly:     { label: "Anomaly",     badgeBg: "bg-orange-100", badgeText: "text-orange-700", icon: "⚠️" },
  risk:        { label: "Risk",        badgeBg: "bg-red-100",    badgeText: "text-red-700",    icon: "🔴" },
  opportunity: { label: "Opportunity", badgeBg: "bg-green-100",  badgeText: "text-green-700",  icon: "💡" },
  efficiency:  { label: "Efficiency",  badgeBg: "bg-purple-100", badgeText: "text-purple-700", icon: "⚡" },
  quality:     { label: "Quality",     badgeBg: "bg-teal-100",   badgeText: "text-teal-700",   icon: "✅" },
};

// ─── Severity Config ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  InsightSeverity,
  { dotBg: string; label: string; pillBg: string; pillText: string }
> = {
  high:   { dotBg: "bg-red-500",   label: "High",   pillBg: "bg-red-50",   pillText: "text-red-600"   },
  medium: { dotBg: "bg-amber-500", label: "Medium", pillBg: "bg-amber-50", pillText: "text-amber-600" },
  low:    { dotBg: "bg-gray-400",  label: "Low",    pillBg: "bg-gray-50",  pillText: "text-gray-500"  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function InsightCard({ insight, index, onDrillDown }: InsightCardProps) {
  const category = CATEGORY_CONFIG[insight.category] ?? CATEGORY_CONFIG.trend;
  const severity = SEVERITY_CONFIG[insight.severity] ?? SEVERITY_CONFIG.low;
  const isV3 = isInsightResult(insight);
  const v3 = isV3 ? (insight as InsightResult) : null;
  const kpis = v3?.drill_down?.overviewKpis ?? [];

  return (
    <div
      onClick={() => isV3 && onDrillDown?.(v3!)}
      className={`insight-card group px-5 py-4 flex flex-col h-full gap-4 transition-all duration-200 ${isV3 && onDrillDown ? 'cursor-pointer hover:bg-slate-50/50' : ''}`}
      style={{
        opacity: 0,
        animation: `insight-fade-in 0.35s ease forwards`,
        animationDelay: `${index * 80}ms`,
      }}
    >
      {/* Header row: category badge + severity pill */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${category.badgeBg} ${category.badgeText}`}
          >
            <span className="text-[13px]">{category.icon}</span>
            {category.label}
          </span>

          {/* v3: group + priority_tag */}
          {v3?.group && (
            <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">{v3.group}</span>
          )}
          {v3?.priority_tag && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              {v3.priority_tag}
            </span>
          )}
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${severity.pillBg} ${severity.pillText}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${severity.dotBg}`} />
          {severity.label}
        </span>
      </div>

      {/* Insight text */}
      <h3 className="text-[15px] font-bold text-slate-900 leading-snug">
        {insight.text}
      </h3>

      {/* v3: summary */}
      {v3?.summary && (
        <p className="text-[13px] text-slate-500 leading-relaxed line-clamp-2">{v3.summary}</p>
      )}

      {/* KPI Grid */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-1">
          {kpis.map((kpi: any) => {
            const isNegative = kpi.value !== null && kpi.value < 0;
            const isPositive = kpi.value !== null && kpi.value > 0;
            let valueColor = "text-slate-900";
            if (kpi.formatted.includes("%")) {
              valueColor = isNegative ? "text-red-600" : (isPositive ? "text-emerald-600" : "text-slate-900");
            } else if (kpi.highlighted) {
              valueColor = isNegative ? "text-red-600" : "text-emerald-600";
            }
            return (
              <div key={kpi.key} className="rounded-xl px-4 py-3 flex flex-col gap-1 border border-slate-200 bg-white shadow-sm">
                <span className={`text-xl font-bold tabular-nums tracking-tight ${valueColor}`}>
                  {kpi.formatted}
                </span>
                <span className="text-[12px] font-medium text-slate-500 truncate" title={kpi.label}>
                  {kpi.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Callouts */}
      <div className="flex flex-col gap-2 mt-1">
        {v3?.risk_callout && (
          <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <span className="text-red-500 text-[13px] mt-0.5">🔴</span>
            <div>
              <span className="text-[12px] font-bold text-red-700 mr-2 uppercase tracking-wide">Risk:</span>
              <span className="text-[12px] text-red-700 leading-relaxed">{v3.risk_callout}</span>
            </div>
          </div>
        )}
        {v3?.decision_callout && (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <span className="text-amber-500 text-[13px] mt-0.5">⚡</span>
            <div>
              <span className="text-[12px] font-bold text-amber-800 mr-2 uppercase tracking-wide">Decision:</span>
              <span className="text-[12px] text-amber-800 leading-relaxed">{v3.decision_callout}</span>
            </div>
          </div>
        )}
        {v3?.action_callout && (
          <div className="flex items-start gap-2.5 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
            <span className="text-green-500 text-[13px] mt-0.5">✅</span>
            <div>
              <span className="text-[12px] font-bold text-green-700 mr-2 uppercase tracking-wide">Action:</span>
              <span className="text-[12px] text-green-700 leading-relaxed">{v3.action_callout}</span>
            </div>
          </div>
        )}
      </div>

      {/* v3: Drill Down button */}
      {isV3 && onDrillDown && (
        <div className="mt-2 flex items-center gap-1 self-end text-[12px] font-semibold text-indigo-600 group-hover:text-indigo-800 transition-colors">
          Click to View Detailed Breakdown <ChevronRight size={13} />
        </div>
      )}
    </div>
  );
}

// ─── Keyframe Styles (injected once) ─────────────────────────────────────────

export function InsightCardStyles() {
  return (
    <style>{`
      @keyframes insight-fade-in {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0);   }
      }
    `}</style>
  );
}
