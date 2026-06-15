/**
 * Severity Evaluator — Phase 5 (v3)
 *
 * Evaluates severity_logic conditions against resolved metrics.
 * Supports stats-aware thresholds like `delta_pct > avg * 1.2` by
 * injecting avg/max/min from the dataStats map into the evaluation context.
 */

import type { InsightSeverity } from "../types";
import type { DataStats } from "./dataStatsComputer";

/**
 * Evaluate a single severity condition string.
 * The condition can reference:
 *   - named calculation keys (e.g. `total_revenue`)
 *   - `avg`, `max`, `min` from dataStats for a given field
 *   - simple AND/OR/comparison operators
 */
function tryCondition(
  condition: string,
  resolved: Record<string, number>,
  statsContext: Record<string, number>
): boolean {
  if (!condition) return false;
  try {
    const context = { ...statsContext, ...resolved };
    const paramNames = Object.keys(context);
    const paramValues = Object.values(context);

    const expr = condition
      .replace(/\bAND\s*\(/gi, "(")
      .replace(/\bOR\s*\(/gi, "(")
      .replace(/,\s*/g, " && ")
      .replace(/=(?!=)/g, "===")
      .replace(/!===/g, "!==");

    // eslint-disable-next-line no-new-func
    const fn = new Function(...paramNames, `return !!(${expr});`);
    return fn(...paramValues);
  } catch {
    return false;
  }
}

/**
 * Build a flat stats context object from DataStats.
 * For severity conditions, we inject `avg`, `max`, `min` as scalars.
 * If multiple fields have stats, we use the primary metric's stats
 * (first key that appears in both resolved and dataStats).
 */
function buildStatsContext(
  resolved: Record<string, number>,
  dataStats?: DataStats
): Record<string, number> {
  if (!dataStats) return {};

  const context: Record<string, number> = {};

  // Try to find the primary resolved metric in dataStats
  for (const resolvedKey of Object.keys(resolved)) {
    if (dataStats[resolvedKey]) {
      context.avg = dataStats[resolvedKey].avg;
      context.max = dataStats[resolvedKey].max;
      context.min = dataStats[resolvedKey].min;
      break;
    }
  }

  // Also inject per-field stats as fieldName_avg, fieldName_max, fieldName_min
  for (const [field, stats] of Object.entries(dataStats)) {
    context[`${field}_avg`] = stats.avg;
    context[`${field}_max`] = stats.max;
    context[`${field}_min`] = stats.min;
  }

  return context;
}

/**
 * Evaluate the severity for a v3 insight.
 *
 * @param severityLogic  Map of severity level → condition string
 * @param resolved       Resolved metric registry from the scoped executor
 * @param dataStats      Optional data stats for stats-aware thresholds
 */
export function evaluateV3Severity(
  severityLogic: Record<string, string>,
  resolved: Record<string, number>,
  dataStats?: DataStats
): InsightSeverity {
  const statsCtx = buildStatsContext(resolved, dataStats);

  if (severityLogic.high && tryCondition(severityLogic.high, resolved, statsCtx)) return "high";
  if (severityLogic.medium && tryCondition(severityLogic.medium, resolved, statsCtx)) return "medium";
  return "low";
}
