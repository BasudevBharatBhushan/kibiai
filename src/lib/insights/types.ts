/**
 * Shared TypeScript types for the Business Insight Engine — v3 only.
 *
 * Pipeline:
 *   AI response → parseInsightResponse() → AIInsightItem[]
 *   Items + dataset → executeV3InsightPlan() → InsightResult[]
 *   InsightResult[] → InsightCard / InsightDrillDownModal
 */

// ═══════════════════════════════════════════════════════════════════
// Shared Enums
// ═══════════════════════════════════════════════════════════════════

/** The 6 allowed insight categories (used for UI grouping and badge colours) */
export type InsightCategory =
  | "trend"
  | "anomaly"
  | "risk"
  | "opportunity"
  | "efficiency"
  | "quality";

/** Severity level derived from severity_logic evaluation */
export type InsightSeverity = "high" | "medium" | "low";

/** Calculation scope — explicit, required on every calculation */
export type CalcScope = "per_record" | "period" | "derived";

// ═══════════════════════════════════════════════════════════════════
// AI Plan Types (what the AI returns)
// ═══════════════════════════════════════════════════════════════════

/** A single AI-defined calculation — includes explicit scope */
export interface AICalculation {
  scope: CalcScope;
  description?: string;
  /** Valid Excel formula string (whitelist enforced by AI system instruction) */
  formula: string;
}

/** One KPI card in the Overview tab */
export interface OverviewKPI {
  key: string;
  label: string;
  /** Up to 2 per insight may be highlighted */
  highlighted?: boolean;
}

/** Drill-down configuration block — required on every insight */
export interface DrillDownConfig {
  /** Field name from schema — JS partitions dataset by this dimension */
  breakdown_by: string;
  /** Ordered calculation keys — dependencies BEFORE the calcs that use them */
  calc_trace: string[];
  /** KPI cards shown in the Overview tab */
  overview_kpis: OverviewKPI[];
  /** Time bucket for Trend tab */
  trend_bucket: "day" | "week" | "month";
}

/** Visualization / Trend chart config — optional per insight */
export interface VisualizationConfig {
  type: "line" | "bar" | "table";
  trend_metric: string;
  date_field: string;
  breakdown_metric?: string;
  sort_by?: string;
  limit?: number;
}

/** Data quality gate — optional */
export interface DataQualityCheck {
  required: boolean;
  min_threshold: number;
}

/**
 * One insight item — as returned by the AI and validated by the parser.
 * The JS executor receives an array of these and computes InsightResult[].
 */
export interface AIInsightItem {
  id: string;
  /** Logical grouping label, e.g. "Revenue", "Operations" */
  group: string;
  category: InsightCategory;
  /** Display badge, e.g. "HIGH RISK", "OPPORTUNITY" */
  priority_tag: string;
  /** Tailwind/CSS colour class for severity UI */
  severity_color: string;
  /** e.g. "Total sales reached {totalSales} in the period." */
  statement_template: string;
  summary_template?: string;
  /** Map of placeholder name → calculation definition */
  calculations: Record<string, AICalculation>;
  /** Map of severity level → condition string using calc keys */
  severity_logic: Record<string, string>;
  risk_callout?: string;
  decision_callout?: string;
  action_callout?: string;
  data_quality_check?: DataQualityCheck;
  drill_down: DrillDownConfig;
  visualization?: VisualizationConfig;
}

// ═══════════════════════════════════════════════════════════════════
// Runtime Types (produced by the JS executor)
// ═══════════════════════════════════════════════════════════════════

/** One row in the Breakdown table */
export interface BreakdownRow {
  groupKey: string;
  metrics: Record<string, number>;
  share_pct: number;
}

/** One point in the Trend chart series */
export interface TrendPoint {
  label: string;
  value: number;
  bucketStart: string;
  bucketEnd: string;
}

/** One entry in the Calculation Trace (resolved) */
export interface CalcTraceEntry {
  key: string;
  description?: string;
  formula: string;
  scope: CalcScope;
  resolvedValue: number | string | null;
}

/** Resolved KPI card — shown in Overview tab */
export interface ResolvedKPI {
  key: string;
  label: string;
  highlighted: boolean;
  value: number | null;
  /** Formatted string, e.g. "$38,950" or "38.3%" */
  formatted: string;
}

/** Data quality result per insight */
export type DataQualityState = "pass" | "warn" | "suppress";

/**
 * The fully resolved insight card — produced by executeV3InsightPlan().
 * This is what gets rendered in InsightCard / InsightDrillDownModal
 * and persisted to insight_results.
 */
export interface InsightResult {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  /** Fully resolved statement with all placeholders filled */
  text: string;
  /** Logical grouping label */
  group: string;
  priority_tag: string;
  severity_color: string;
  summary?: string;
  risk_callout?: string;
  decision_callout?: string;
  action_callout?: string;
  data_quality_state?: DataQualityState;
  /** Resolved metric values for all calculations */
  resolvedMetrics: Record<string, number>;
  drill_down: {
    breakdown_by: string;
    trend_bucket: "day" | "week" | "month";
    breakdownData?: BreakdownRow[];
    trendData?: TrendPoint[];
    calcTrace?: CalcTraceEntry[];
    overviewKpis?: ResolvedKPI[];
  };
  /** Reference to the original AI plan item (for re-running drill-downs) */
  _plan?: AIInsightItem;
  /** Normalized dataset snapshot — passed from InsightDashboard */
  _dataset?: Record<string, unknown>[];
}

/** Type-guard: checks for v3 runtime fields */
export function isInsightResult(r: unknown): r is InsightResult {
  return (
    !!r &&
    typeof r === "object" &&
    "drill_down" in r &&
    "resolvedMetrics" in r
  );
}
