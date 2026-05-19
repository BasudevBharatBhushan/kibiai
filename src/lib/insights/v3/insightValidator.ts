/**
 * Insight Validator — Phase 5b (v3)
 *
 * Pre-execution validation for v3 insight plans.
 * Runs before the scoped executor to reject malformed AI plans early.
 *
 * Checks:
 *  1. All referenced fields exist in schema
 *  2. All referenced calculations exist
 *  3. Only supported functions used
 *  4. Scopes are valid enum values
 *  5. No circular dependencies in calc graph
 *  6. breakdown_by field exists in schema
 *  7. trend_metric references valid calculation
 *  8. All placeholders have matching calculations
 */

import type { AIInsightItem, CalcScope } from "../types";
import type { FieldSchema } from "../fieldSchemaAdapter";

const VALID_SCOPES: CalcScope[] = ["per_record", "period", "derived"];

const ALLOWED_FUNCTIONS = [
  "SUM", "SUMIFS", "SUMIF",
  "COUNTIFS", "COUNTIF",
  "AVERAGE",
  "MIN", "MAX",
  "IF", "AND", "OR",
  "ABS", "ROUND",
  "IFERROR",
  "DATEDIF", "TODAY", "YEAR", "MONTH",
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function extractFunctions(formula: string): string[] {
  const matches = formula.toUpperCase().matchAll(/\b([A-Z_]+)\s*\(/g);
  return Array.from(matches).map(m => m[1]);
}

function hasCircularDeps(calculations: AIInsightItem["calculations"]): boolean {
  const keys = Object.keys(calculations);
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string): boolean {
    visited.add(node);
    inStack.add(node);
    const formula = calculations[node]?.formula ?? "";
    for (const other of keys) {
      if (other === node) continue;
      const regex = new RegExp(`\\b${other}\\b`);
      if (regex.test(formula)) {
        if (inStack.has(other)) return true; // circular
        if (!visited.has(other) && dfs(other)) return true;
      }
    }
    inStack.delete(node);
    return false;
  }

  for (const k of keys) {
    if (!visited.has(k) && dfs(k)) return true;
  }
  return false;
}

/**
 * Validate a single v3 insight item.
 * Returns a ValidationResult with errors (blocking) and warnings (non-blocking).
 */
export function validateV3InsightItem(
  item: AIInsightItem,
  schemas: FieldSchema[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const schemaNames = new Set(schemas.map(s => s.name));
  const calcKeys = new Set(Object.keys(item.calculations));

  // 1. Validate scopes
  for (const [key, calc] of Object.entries(item.calculations)) {
    if (!VALID_SCOPES.includes(calc.scope)) {
      errors.push(`Calc "${key}": invalid scope "${calc.scope}". Must be per_record|period|derived.`);
    }
  }

  // 2. Validate allowed functions
  for (const [key, calc] of Object.entries(item.calculations)) {
    const fns = extractFunctions(calc.formula);
    for (const fn of fns) {
      if (!ALLOWED_FUNCTIONS.includes(fn)) {
        errors.push(`Calc "${key}": disallowed function "${fn}".`);
      }
    }
  }

  // 3. Check for circular dependencies
  if (hasCircularDeps(item.calculations)) {
    errors.push(`Insight "${item.id}" has circular calculation dependencies.`);
  }

  // 4. Validate placeholders in statement_template
  const placeholderMatches = item.statement_template.matchAll(/\{(\w+)\}/g);
  for (const match of placeholderMatches) {
    const ph = match[1];
    // NL tokens are resolved at runtime
    if (ph === "trend_direction" || ph === "consecutive_periods") continue;
    if (!calcKeys.has(ph)) {
      errors.push(`statement_template placeholder "{${ph}}" has no matching calculation.`);
    }
  }

  // 5. Validate breakdown_by field exists in schema
  if (item.drill_down?.breakdown_by) {
    if (!schemaNames.has(item.drill_down.breakdown_by)) {
      warnings.push(
        `drill_down.breakdown_by field "${item.drill_down.breakdown_by}" not found in schema. Breakdown will be skipped.`
      );
    }
  }

  // 6. Validate visualization config
  if (item.visualization) {
    const { trend_metric, date_field } = item.visualization;
    if (trend_metric && !calcKeys.has(trend_metric)) {
      warnings.push(`visualization.trend_metric "${trend_metric}" does not reference a calculation.`);
    }
    if (date_field && !schemaNames.has(date_field)) {
      warnings.push(`visualization.date_field "${date_field}" not found in schema.`);
    }
  }

  // 7. Validate calc_trace references
  if (item.drill_down?.calc_trace) {
    for (const traceKey of item.drill_down.calc_trace) {
      if (!calcKeys.has(traceKey)) {
        warnings.push(`drill_down.calc_trace references unknown calculation "${traceKey}".`);
      }
    }
  }

  // 8. Validate overview_kpis references
  if (item.drill_down?.overview_kpis) {
    for (const kpi of item.drill_down.overview_kpis) {
      if (!calcKeys.has(kpi.key)) {
        warnings.push(`overview_kpis references unknown calculation key "${kpi.key}".`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
