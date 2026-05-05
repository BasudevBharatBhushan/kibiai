/**
 * Shared TypeScript types for the Business Insight Engine — ST-6
 *
 * These types flow through the full insight pipeline:
 *   AI response → parseInsightResponse() → AIInsightPlan
 *   AIInsightPlan + dataset → executeInsightPlan() → InsightResult[]
 *   InsightResult[] → InsightCard / InsightDashboard
 */

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

/** A single AI-defined calculation — formula only, no data */
export interface AICalculation {
  description: string;
  /** Valid Excel formula string (whitelist enforced by AI system instruction) */
  formula: string;
}

/**
 * One AI-planned insight item.
 * AI fills this; JS uses it to compute and render the final InsightResult.
 */
export interface AIInsightItem {
  id: string;
  category: InsightCategory;
  /** e.g. "Total sales reached {totalSales} in the last 30 days." */
  statement_template: string;
  /** Map of placeholder name → calculation definition */
  calculations: Record<string, AICalculation>;
  severity_logic: {
    /** String condition using named calc keys, e.g. "totalSales > 100000" */
    high: string;
    medium: string;
    low: string;
  };
}

/** The full JSON response from the Business Insight AI */
export interface AIInsightPlan {
  response_to_user?: string;
  insights: AIInsightItem[];
}

/**
 * The final resolved insight card — produced by JS after formula execution.
 * This is what gets rendered in InsightCard and persisted to insight_results.
 */
export interface InsightResult {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  /** Fully resolved statement with all placeholders filled */
  text: string;
}
