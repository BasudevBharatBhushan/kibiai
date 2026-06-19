/**
 * Calc Trace Builder — Phase 5 (v3)
 *
 * Builds the ordered CalcTraceEntry[] array for the Calculation Trace tab.
 * Uses the AI-defined calc_trace order (already dependency-sorted) and
 * enriches each entry with the resolved runtime value.
 */

import type { CalcTraceEntry, AIInsightItem } from "../types";

/**
 * Build the calculation trace for a resolved insight.
 *
 * @param plan         The v3 insight plan item
 * @param resolved     The resolved metric registry (key → value)
 * @returns Ordered CalcTraceEntry[] for the Trace tab
 */
export function buildCalcTrace(
  plan: AIInsightItem,
  resolved: Record<string, number>
): CalcTraceEntry[] {
  const traceKeys = plan.drill_down?.calc_trace ?? Object.keys(plan.calculations);

  const entries: CalcTraceEntry[] = [];

  for (const key of traceKeys) {
    const calc = plan.calculations[key];
    if (!calc) continue;

    entries.push({
      key,
      description: calc.description,
      formula: calc.formula,
      scope: calc.scope,
      resolvedValue: resolved[key] ?? null,
    });
  }

  // Append any calculations not explicitly listed in calc_trace
  for (const [key, calc] of Object.entries(plan.calculations)) {
    if (traceKeys.includes(key)) continue;
    entries.push({
      key,
      description: calc.description,
      formula: calc.formula,
      scope: calc.scope,
      resolvedValue: resolved[key] ?? null,
    });
  }

  return entries;
}
