"use client";

import React, { useState } from "react";
import { Lightbulb } from "lucide-react";
import type { InsightResult, InsightCategory } from "@/lib/insights/types";
import { isInsightResult } from "@/lib/insights/types";

import { InsightCard, InsightCardStyles } from "./InsightCard";
import { InsightDrillDownModal } from "./InsightDrillDownModal";

interface InsightDashboardProps {
  insights: InsightResult[];
  isLoading: boolean;
  /** Optional: passed to the drill-down modal for date-context substitution */
  reportContext?: {
    reportStart?: string;
    reportEnd?: string;
    previousStart?: string;
    previousEnd?: string;
  };
}

// Category display order and labels for section headers
const CATEGORY_ORDER: InsightCategory[] = [
  "risk",
  "anomaly",
  "trend",
  "opportunity",
  "efficiency",
  "quality",
];

const CATEGORY_LABELS: Record<InsightCategory, string> = {
  risk:        "Risk",
  anomaly:     "Anomalies",
  trend:       "Trends",
  opportunity: "Opportunities",
  efficiency:  "Efficiency",
  quality:     "Quality",
};

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

function InsightSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 bg-white shadow-sm px-5 py-4 flex flex-col gap-3 animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="h-5 w-20 rounded-full bg-slate-200" />
            <div className="h-5 w-14 rounded-full bg-slate-200" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-slate-200" />
            <div className="h-3 w-4/5 rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 mb-4">
        <Lightbulb size={24} />
      </div>
      <h3 className="text-sm font-semibold text-slate-800 mb-1">
        No insights yet
      </h3>
      <p className="text-[12.5px] text-slate-500 leading-relaxed max-w-xs">
        Ask the Business Insight Assistant to generate insights from your
        report schema. It will analyze your fields and compute structured
        metrics — without seeing your actual data.
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InsightDashboard({ insights, isLoading, reportContext }: InsightDashboardProps) {
  const [drillDownInsight, setDrillDownInsight] = useState<InsightResult | null>(null);

  // Group insights by category
  const grouped: Partial<Record<InsightCategory, InsightResult[]>> = {};
  for (const ins of insights) {
    if (!grouped[ins.category]) grouped[ins.category] = [];
    grouped[ins.category]!.push(ins);
  }

  // Global card index for staggered animation
  let globalIndex = 0;

  const handleDrillDown = (insight: InsightResult) => {
    setDrillDownInsight(insight);
  };

  const handleModalClose = () => {
    setDrillDownInsight(null);
  };

  return (
    <>
      <div className="h-full overflow-y-auto scrollbar-minimal px-4 py-4 flex flex-col gap-6">
        <InsightCardStyles />

        {isLoading && <InsightSkeleton />}

        {!isLoading && insights.length === 0 && <EmptyState />}

        {!isLoading &&
          CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => (
            <section key={cat} className="flex flex-col gap-3">
              {/* Section header */}
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 px-1">
                {CATEGORY_LABELS[cat]}
              </h4>

              {/* Cards */}
              {grouped[cat]!.map((insight) => {
                const idx = globalIndex++;
                return (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    index={idx}
                    onDrillDown={
                      isInsightResult(insight)
                        ? handleDrillDown
                        : undefined
                    }
                  />
                );
              })}
            </section>
          ))}
      </div>

      {/* v3 Drill-Down Modal */}
      {drillDownInsight && (
        <InsightDrillDownModal
          insight={drillDownInsight}
          onClose={handleModalClose}
          context={reportContext}
        />
      )}
    </>
  );
}
