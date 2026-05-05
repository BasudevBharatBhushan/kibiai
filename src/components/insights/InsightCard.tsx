"use client";

import React from "react";
import type { InsightResult, InsightCategory, InsightSeverity } from "@/lib/insights/types";

interface InsightCardProps {
  insight: InsightResult;
  /** Used for staggered animation delay */
  index: number;
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

export function InsightCard({ insight, index }: InsightCardProps) {
  const category = CATEGORY_CONFIG[insight.category] ?? CATEGORY_CONFIG.trend;
  const severity = SEVERITY_CONFIG[insight.severity] ?? SEVERITY_CONFIG.low;

  return (
    <div
      className="insight-card group rounded-xl border border-slate-200 bg-white shadow-sm px-5 py-4 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      style={{
        opacity: 0,
        animation: `insight-fade-in 0.35s ease forwards`,
        animationDelay: `${index * 80}ms`,
      }}
    >
      {/* Header row: category badge + severity pill */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${category.badgeBg} ${category.badgeText}`}
        >
          <span className="text-[13px]">{category.icon}</span>
          {category.label}
        </span>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${severity.pillBg} ${severity.pillText}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${severity.dotBg}`} />
          {severity.label}
        </span>
      </div>

      {/* Insight text */}
      <p className="text-[13.5px] leading-relaxed text-slate-700">
        {insight.text}
      </p>
    </div>
  );
}

// ─── Keyframe Styles (injected once) ─────────────────────────────────────────

// Uses a style tag so we don't need a separate CSS file.
// This renders once in the DOM when any InsightCard mounts.
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
