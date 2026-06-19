"use client";

/**
 * InsightDrillDownModal — Phase 6 (v3)
 *
 * Full-screen slide-up modal with 4 tabs:
 *   Overview → KPI cards + callout banners
 *   Breakdown → grouped table with share %
 *   Trend → line/bar sparkline
 *   Calc Trace → dependency-ordered formula audit
 *
 * Lazy-loads breakdown and trend data on first tab switch.
 */

import { useState, useRef, useCallback, useEffect } from "react";

import {
  X,
  BarChart2,
  TrendingUp,
  TableProperties,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import type { InsightResult, BreakdownRow, TrendPoint, CalcTraceEntry, ResolvedKPI } from "@/lib/insights/types";

import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "overview" | "breakdown" | "trend" | "trace";

interface DrillDownContext {
  reportStart?: string;
  reportEnd?: string;
  previousStart?: string;
  previousEnd?: string;
}

interface InsightDrillDownModalProps {
  insight: InsightResult;
  onClose: () => void;
  context?: DrillDownContext;
}


// ─── Tab Config ───────────────────────────────────────────────────────────────

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview",   label: "Overview" },
  { id: "breakdown",  label: "Breakdown" },
  { id: "trend",      label: "Trend" },
  { id: "trace",      label: "Calculation Trace" },
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ kpi }: { kpi: ResolvedKPI }) {
  const isNegative = kpi.value !== null && kpi.value < 0;
  const isPositive = kpi.value !== null && kpi.value > 0;
  
  let valueColor = "text-slate-900";
  
  if (kpi.formatted.includes("%")) {
    valueColor = isNegative ? "text-red-600" : (isPositive ? "text-emerald-600" : "text-slate-900");
  } else if (kpi.highlighted) {
    valueColor = isNegative ? "text-red-600" : "text-emerald-600";
  }

  return (
    <div className="rounded-xl px-5 py-4 flex flex-col gap-2 border border-slate-200 bg-white shadow-sm">
      <span className={`text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${valueColor}`}>
        {kpi.formatted}
      </span>
      <span className="text-[13px] font-medium text-slate-500">
        {kpi.label}
      </span>
    </div>
  );
}

// ─── Callout Banner ───────────────────────────────────────────────────────────

function CalloutBanner({ type, text }: { type: "risk" | "decision" | "action"; text: string }) {
  const config = {
    risk:     { Icon: AlertTriangle, iconColor: "text-red-500", bg: "bg-red-50",    border: "border-red-200",    text: "text-red-700",    label: "Risk:" },
    decision: { Icon: Zap,           iconColor: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200",   text: "text-amber-800",   label: "Decision:" },
    action:   { Icon: CheckCircle2,  iconColor: "text-green-500", bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  label: "Action:" },
  }[type];

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${config.bg} ${config.border}`}>
      <config.Icon size={16} className={`mt-0.5 shrink-0 ${config.iconColor}`} />
      <div>
        <span className={`text-[13px] font-bold ${config.text} mr-2`}>{config.label}</span>
        <span className={`text-[13px] leading-relaxed ${config.text}`}>{text}</span>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ insight }: { insight: InsightResult }) {
  const kpis = insight.drill_down.overviewKpis ?? [];
  const highlighted = kpis.filter((k: ResolvedKPI) => k.highlighted);
  const secondary = kpis.filter((k: ResolvedKPI) => !k.highlighted);


  return (
    <div className="flex flex-col gap-5 pt-4">
      {/* KPI Grid */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {kpis.map((kpi: ResolvedKPI) => <KPICard key={kpi.key} kpi={kpi} />)}
        </div>
      )}

      {/* Callout banners */}
      <div className="flex flex-col gap-3">
        {insight.risk_callout && <CalloutBanner type="risk" text={insight.risk_callout} />}
        {insight.decision_callout && <CalloutBanner type="decision" text={insight.decision_callout} />}
        {insight.action_callout && <CalloutBanner type="action" text={insight.action_callout} />}
      </div>
    </div>
  );
}

// ─── Breakdown Tab ────────────────────────────────────────────────────────────

function BreakdownTab({ rows, breakdownField }: { rows: BreakdownRow[]; breakdownField: string }) {
  if (!rows.length) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">
        No breakdown data available.
      </div>
    );
  }

  // Metric columns (all except groupKey and share_pct)
  const metricKeys = Object.keys(rows[0].metrics);

  const formatNum = (n: number) =>
    Math.abs(n) >= 1000
      ? n.toLocaleString(undefined, { maximumFractionDigits: 1 })
      : n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const formatMetricName = (name: string) => {
    return name
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  return (
    <div className="py-4 overflow-x-auto">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="bg-slate-50 text-left">
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 rounded-tl-lg">{formatMetricName(breakdownField)}</th>
            {metricKeys.map(k => (
              <th key={k} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">{formatMetricName(k)}</th>
            ))}
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Share</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-left rounded-tr-lg w-32">Distribution</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.groupKey} className={`border-t border-slate-100 hover:bg-slate-50/50 transition-colors`}>
              <td className="px-4 py-3 text-slate-700 font-medium">{row.groupKey}</td>
              {metricKeys.map(k => (
                <td key={k} className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {formatNum(row.metrics[k] ?? 0)}
                </td>
              ))}
              <td className="px-4 py-3 text-right tabular-nums text-slate-600 font-medium">
                {row.share_pct.toFixed(1)}%
              </td>
              <td className="px-4 py-3">
                <div className="w-full max-w-[120px] h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                    style={{ width: `${Math.min(row.share_pct, 100)}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Trend Tab ────────────────────────────────────────────────────────────────

function TrendTab({ points, metric }: { points: TrendPoint[]; metric: string }) {
  if (!points.length) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">
        No trend data available for this period.
      </div>
    );
  }

  const formatVal = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` :
    v >= 1_000     ? `${(v / 1_000).toFixed(1)}K` :
    v.toLocaleString(undefined, { maximumFractionDigits: 1 });

  const chartOptions: Highcharts.Options = {
    chart: { type: 'area', height: 220, backgroundColor: 'transparent' },
    title: { text: '' },
    legend: { enabled: false },
    xAxis: { 
      categories: points.map(p => p.label),
      labels: { style: { color: '#94a3b8', fontSize: '10px' } },
      lineWidth: 0,
      tickWidth: 0,
    },
    yAxis: { 
      title: { text: undefined },
      labels: { enabled: false },
      gridLineColor: 'transparent',
    },
    tooltip: {
      backgroundColor: '#1e293b',
      style: { color: '#f8fafc' },
      borderWidth: 0,
      shadow: false,
      valueDecimals: 1,
      formatter: function() {
        return `<b>${this.x}</b><br/>${metric}: ${formatVal(Number(this.y))}`;
      }
    },
    plotOptions: {
      area: {
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, 'rgba(16, 185, 129, 0.25)'],
            [1, 'rgba(16, 185, 129, 0.0)']
          ]
        },
        marker: { radius: 4, fillColor: '#10b981', symbol: 'circle' },
        lineWidth: 2,
        lineColor: '#10b981',
        states: { hover: { lineWidth: 2 } },
        threshold: null
      }
    },
    series: [{
      type: 'area',
      name: metric,
      data: points.map(p => p.value)
    }],
    credits: { enabled: false }
  };

  return (
    <div className="py-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-4">
          {metric} TREND — CURRENT PERIOD
        </p>

        {/* Line chart with Gradient fill */}
        <div className="-mx-2">
          <HighchartsReact highcharts={Highcharts} options={chartOptions} />
        </div>

        {/* Data table */}
        <div className="overflow-x-auto mt-4 pt-4 border-t border-slate-100">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="text-left">
                {points.map((pt, i) => (
                  <th key={i} className="px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                    {pt.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {points.map((pt, i) => (
                  <td key={i} className="px-2 py-2 text-[14px] text-slate-700 tabular-nums">
                    {formatVal(pt.value)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Calc Trace Tab ───────────────────────────────────────────────────────────

function CalcTraceTab({ entries }: { entries: CalcTraceEntry[] }) {
  if (!entries.length) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">
        No calculation trace available.
      </div>
    );
  }

  const formatVal = (v: number | string | null, scope: string) => {
    if (scope === "per_record") return "per record";
    if (v === null) return "—";
    if (typeof v === "number") {
      return isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
    }
    return String(v);
  };

  return (
    <div className="py-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden pb-2">
        <div className="px-5 py-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            HOW THIS WAS COMPUTED
          </span>
        </div>
        <div className="flex flex-col">
          {entries.map((entry) => (
            <div key={entry.key} className="flex flex-wrap sm:flex-nowrap items-center justify-between px-5 py-3 border-t border-slate-200/60 bg-slate-50/50 hover:bg-slate-100/50 transition-colors gap-4">
              <div className="w-full sm:w-1/4 text-[12px] font-mono text-slate-600 break-words pr-2">
                {entry.key}
              </div>
              <div className="w-full sm:w-1/2 text-[11px] font-mono text-slate-400 break-words pr-2">
                {entry.formula}
              </div>
              <div className="w-full sm:w-1/4 text-right">
                <span className={`text-[13px] font-bold ${entry.scope === "per_record" ? "text-slate-800" : "tabular-nums text-slate-900"}`}>
                  {formatVal(entry.resolvedValue, entry.scope)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function InsightDrillDownModal({ insight, onClose, context }: InsightDrillDownModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const breakdownRows = insight.drill_down.breakdownData ?? [];
  const trendPoints = insight.drill_down.trendData ?? [];

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
  };

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const catConfig: Record<string, { icon: string; color: string }> = {
    trend:       { icon: "📈", color: "text-blue-600" },
    anomaly:     { icon: "⚠️", color: "text-orange-600" },
    risk:        { icon: "🔴", color: "text-red-600" },
    opportunity: { icon: "💡", color: "text-green-600" },
    efficiency:  { icon: "⚡", color: "text-purple-600" },
    quality:     { icon: "✅", color: "text-teal-600" },
  };
  const cat = catConfig[insight.category] ?? { icon: "💡", color: "text-slate-600" };

  const calcTrace = insight.drill_down.calcTrace ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div className="flex w-full max-w-2xl flex-col bg-white shadow-2xl rounded-2xl pointer-events-auto max-h-full overflow-hidden animate-zoom-in">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  {insight.group || 'Finance'}
                </span>
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700`}>
                  {insight.category}
                </span>
                {insight.priority_tag && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
                    {insight.priority_tag}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-full p-2 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
              {insight.text}
            </h2>
            {insight.summary && (
              <p className="mt-2 text-[14px] text-slate-500">
                {insight.summary}
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="px-6 pb-4 border-b border-slate-100">
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100/50">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex-1 py-2 text-[13px] font-semibold transition-all rounded-lg ${
                    activeTab === tab.id
                      ? "bg-white text-slate-800 shadow-sm border border-slate-200/50"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 scrollbar-minimal">
            {activeTab === "overview" && <OverviewTab insight={insight} />}

            {activeTab === "breakdown" && (
              <BreakdownTab rows={breakdownRows} breakdownField={insight.drill_down.breakdown_by} />
            )}

            {activeTab === "trend" && (
              <TrendTab points={trendPoints} metric={insight._plan?.visualization?.trend_metric ?? "value"} />
            )}

            {activeTab === "trace" && <CalcTraceTab entries={calcTrace} />}
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
        @keyframes zoom-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-zoom-in {
          animation: zoom-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1) forwards;
        }
      `}</style>
    </>
  );
}
