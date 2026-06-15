/**
 * Scoped Executor — Phase 3 (v3)
 *
 * 3-pass dependency-aware execution engine for v3 insight plans.
 * Replaces v2's heuristic isRowLevelFormula() detection with explicit scope tags.
 *
 * Pass 1: per_record — iterate dataset, compute virtual columns
 * Pass 2: period     — aggregate via HyperFormula (SUMIFS/COUNTIFS)
 * Pass 3: derived    — scalar-on-scalar arithmetic from resolved registry
 *
 * The v2 executeInsightPlan() is UNTOUCHED. This sits alongside it.
 */

import HyperFormula from "hyperformula";
import type {
  AIInsightItem,
  InsightResult,
  ResolvedKPI,
  CalcTraceEntry,
} from "../types";
import { toSafeIdentifier, type FieldSchema } from "../fieldSchemaAdapter";
import { buildCalcTrace } from "./calcTraceBuilder";
import { evaluateV3Severity } from "./severityEvaluator";
import { validateDataQuality } from "./dataQualityValidator";
import { resolveNLTokens } from "./nlTokenResolver";
import type { DataStats } from "./dataStatsComputer";
import { runBreakdownEngine } from "./breakdownEngine";
import { runTrendEngine } from "./trendEngine";

// ─── Utilities ────────────────────────────────────────────────────────────────

function indexToColumnLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function formatValue(val: number): string {
  if (!isFinite(val)) return "—";
  if (Number.isInteger(val)) return val.toLocaleString();
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ─── Topological Sort (Kahn's Algorithm) ─────────────────────────────────────

function topoSort(calculations: AIInsightItem["calculations"]): string[] {
  const keys = Object.keys(calculations);
  const inDegree: Record<string, number> = {};
  const dependents: Record<string, string[]> = {};

  for (const k of keys) {
    inDegree[k] = 0;
    dependents[k] = [];
  }

  for (const k of keys) {
    for (const other of keys) {
      if (k === other) continue;
      const formula = calculations[k].formula;
      const regex = new RegExp(`\\b${other}\\b`);
      if (regex.test(formula)) {
        inDegree[k] = (inDegree[k] ?? 0) + 1;
        dependents[other].push(k);
      }
    }
  }

  const queue = keys.filter(k => inDegree[k] === 0);
  const sorted: string[] = [];

  while (queue.length) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const dep of dependents[node] ?? []) {
      inDegree[dep]--;
      if (inDegree[dep] === 0) queue.push(dep);
    }
  }

  // If sorted.length < keys.length, circular dep detected — fall back to original order
  return sorted.length === keys.length ? sorted : keys;
}

// ─── Pass 1: per_record Materialization ──────────────────────────────────────

function runPerRecordPass(
  dataset: Record<string, unknown>[],
  calcs: AIInsightItem["calculations"],
  orderedKeys: string[]
): Record<string, number[]> {
  const derivedColumns: Record<string, number[]> = {};
  const perRecordKeys = orderedKeys.filter(k => calcs[k]?.scope === "per_record");

  for (const key of perRecordKeys) {
    const calc = calcs[key];
    const colValues: number[] = [];

    for (const row of dataset) {
      try {
        const allNames = [...Object.keys(row), ...Object.keys(derivedColumns)];
        const rowIndex = dataset.indexOf(row);
        const allVals = [
          ...Object.values(row).map(v =>
            typeof v === "number" ? v : parseFloat(String(v) || "0") || 0
          ),
          ...Object.keys(derivedColumns).map(k => derivedColumns[k][rowIndex] ?? 0),
        ];
        // eslint-disable-next-line no-new-func
        const fn = new Function(...allNames, `return (${calc.formula});`);
        const result = fn(...allVals);
        colValues.push(typeof result === "number" && isFinite(result) ? result : 0);
      } catch {
        colValues.push(0);
      }
    }

    derivedColumns[key] = colValues;
  }

  return derivedColumns;
}

// ─── Pass 2: period Aggregation via HyperFormula ─────────────────────────────

function runPeriodPass(
  dataset: Record<string, unknown>[],
  derivedColumns: Record<string, number[]>,
  calcs: AIInsightItem["calculations"],
  orderedKeys: string[],
  resolvedCalcs: Record<string, number>,
  formulaReplacements: (f: string) => string
): Record<string, number> {
  const periodKeys = orderedKeys.filter(k => calcs[k]?.scope === "period");
  const result = { ...resolvedCalcs };

  if (!periodKeys.length || !dataset.length) return result;

  // Build HyperFormula sheet
  const fieldNames = Object.keys(dataset[0]);
  const derivedKeys = Object.keys(derivedColumns);
  const scalarKeys = Object.keys(result);
  const headerRow = [...fieldNames, ...derivedKeys, ...scalarKeys];

  const sheetData: (string | number | boolean | null)[][] = [headerRow];
  for (let i = 0; i < dataset.length; i++) {
    const row = dataset[i];
    sheetData.push([
      ...fieldNames.map(f => {
        const v = row[f];
        return (typeof v === "number" || typeof v === "boolean") ? v : String(v ?? "");
      }),
      ...derivedKeys.map(k => derivedColumns[k][i] ?? 0),
      ...scalarKeys.map(k => result[k]),
    ]);
  }

  for (const key of periodKeys) {
    const calc = calcs[key];
    let formulaStr = formulaReplacements(calc.formula);

    // Inject already-resolved scalars (derived calcs that came before this period calc)
    for (const [sk, sv] of Object.entries(result)) {
      formulaStr = formulaStr.replace(new RegExp(`\\b${sk}\\b`, "g"), String(sv));
    }

    // Map column names to ranges
    const evalRow = new Array(headerRow.length).fill(null);
    sheetData.push(evalRow);
    const formulaRowIdx = sheetData.length - 1;
    const dataRowCount = dataset.length;

    let processedFormula = formulaStr;
    headerRow.forEach((name, colIdx) => {
      const col = indexToColumnLetter(colIdx);
      const isScalar = scalarKeys.includes(name);
      processedFormula = processedFormula.replace(
        new RegExp(`\\b${name}\\b`, "g"),
        isScalar ? `${col}2` : `${col}2:${col}${dataRowCount + 1}`
      );
    });

    sheetData[formulaRowIdx][0] = `=${processedFormula}`;

    try {
      const hf = HyperFormula.buildFromSheets(
        { Sheet1: sheetData as never },
        {
          licenseKey: "gpl-v3",
          dateFormats: ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"],
          maxRows: 200000,
        }
      );
      const val = hf.getCellValue({ sheet: 0, row: formulaRowIdx, col: 0 });
      hf.destroy();

      let numVal: number | null = null;
      if (typeof val === "number") numVal = val;
      else if (typeof val === "string") { const p = parseFloat(val); numVal = isNaN(p) ? null : p; }

      if (numVal !== null) {
        result[key] = numVal;
        // Add as scalar for subsequent calcs in this pass
        scalarKeys.push(key);
        headerRow.push(key);
        // Patch every data row with this scalar value
        for (let ri = 1; ri < formulaRowIdx; ri++) {
          (sheetData[ri] as (string | number | null)[]).push(numVal);
        }
      }
    } catch (err) {
      console.warn(`[ScopedExecutor] Period calc "${key}" failed:`, err);
    }

    // Remove the eval row for the next iteration
    sheetData.pop();
  }

  return result;
}

// ─── Pass 3: derived Scalar-on-Scalar ────────────────────────────────────────

function runDerivedPass(
  calcs: AIInsightItem["calculations"],
  orderedKeys: string[],
  resolvedCalcs: Record<string, number>
): Record<string, number> {
  const derivedKeys = orderedKeys.filter(k => calcs[k]?.scope === "derived");
  const result = { ...resolvedCalcs };

  for (const key of derivedKeys) {
    const calc = calcs[key];
    let formula = calc.formula;

    // Replace known scalar references with their values
    for (const [rk, rv] of Object.entries(result)) {
      formula = formula.replace(new RegExp(`\\b${rk}\\b`, "g"), String(rv));
    }

    // Handle IFERROR(expr, fallback) natively
    formula = formula.replace(/IFERROR\s*\(([^,]+),\s*([^)]+)\)/gi, (_, expr, fallback) => {
      return `(function(){try{return (${expr});}catch(e){return (${fallback});}})()`;
    });

    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function(`return (${formula});`);
      const val = fn();
      if (typeof val === "number" && isFinite(val)) {
        result[key] = val;
      }
    } catch {
      // Try HyperFormula for more complex derived formulas
      try {
        const hf = HyperFormula.buildFromSheets(
          { Sheet1: [[`=${formula}`]] },
          {
            licenseKey: "gpl-v3",
            maxRows: 200000,
          }
        );
        const val = hf.getCellValue({ sheet: 0, row: 0, col: 0 });
        hf.destroy();
        if (typeof val === "number") result[key] = val;
      } catch {
        console.warn(`[ScopedExecutor] Derived calc "${key}" failed.`);
      }
    }
  }

  return result;
}

// ─── Dataset Normalizer ───────────────────────────────────────────────────────

function normalizeDataset(
  dataset: Record<string, unknown>[],
  schemas?: FieldSchema[]
): Record<string, unknown>[] {
  const schemaMap: Record<string, string> = {};
  if (schemas) {
    schemas.forEach(s => {
      if (s.meaning) {
        schemaMap[s.meaning] = s.name;
        schemaMap[s.meaning.toLowerCase()] = s.name;
      }
      schemaMap[s.name] = s.name;
      schemaMap[s.originalName] = s.name;
    });
  }

  return dataset.map(row => {
    const newRow: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      const rawFieldName = key.includes("::") ? key.split("::").pop()! : key;
      let safeKey = toSafeIdentifier(rawFieldName);

      if (schemaMap[key]) safeKey = schemaMap[key];
      else if (schemaMap[rawFieldName]) safeKey = schemaMap[rawFieldName];
      else if (schemaMap[rawFieldName.toLowerCase()]) safeKey = schemaMap[rawFieldName.toLowerCase()];

      let finalVal = val;
      if (typeof val === "string" && (key.toLowerCase().includes("date") || /^\d{4}-\d{2}-\d{2}/.test(val))) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) finalVal = d.toISOString().split("T")[0];
      }

      newRow[safeKey] = finalVal;
    }
    return newRow;
  });
}

// ─── Template Fill ────────────────────────────────────────────────────────────

function fillTemplate(template: string, resolved: Record<string, number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in resolved) return formatValue(resolved[key]);
    return match;
  });
}

// ─── Context Object ───────────────────────────────────────────────────────────

export interface V3InsightContext {
  reportStart?: string;
  reportEnd?: string;
  previousStart?: string;
  previousEnd?: string;
  reportDateField?: string;
}

// ─── Main Export: executeV3InsightPlan ────────────────────────────────────────

/**
 * Execute a v3 insight plan with 3-pass scoped evaluation.
 *
 * @param items    Array of v3 insight items (from parsed AI response)
 * @param dataset  Raw dataset rows
 * @param context  Report period context
 * @param schemas  Field schemas for normalization
 * @param dataStats Optional precomputed data stats for stats-aware severity
 * @returns Array of InsightResult
 */
export function executeV3InsightPlan(
  items: AIInsightItem[],
  dataset: Record<string, unknown>[],
  context?: V3InsightContext,
  schemas?: FieldSchema[],
  dataStats?: DataStats
): InsightResult[] {
  if (!dataset.length) return [];

  const now = new Date();
  const defaultEnd = now.toISOString().split("T")[0];
  const defaultStart = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];

  const reportStart = context?.reportStart ?? defaultStart;
  const reportEnd = context?.reportEnd ?? defaultEnd;
  const prevStart = context?.previousStart ?? defaultStart;
  const prevEnd = context?.previousEnd ?? defaultEnd;

  const midTs = new Date(reportStart).getTime() + (new Date(reportEnd).getTime() - new Date(reportStart).getTime()) / 2;
  const reportMidpoint = new Date(midTs).toISOString().split("T")[0];

  // Context-variable substitution helper
  const substituteContext = (formula: string): string =>
    formula
      .replace(/\bREPORT_START\b/g, `"${reportStart}"`)
      .replace(/\bREPORT_END\b/g, `"${reportEnd}"`)
      .replace(/\bPREV_START\b/g, `"${prevStart}"`)
      .replace(/\bPREV_END\b/g, `"${prevEnd}"`)
      .replace(/\bREPORT_MIDPOINT\b/g, `"${reportMidpoint}"`);

  // Normalize dataset once
  const normalizedDataset = normalizeDataset(dataset, schemas);

  const results: InsightResult[] = [];

  for (const item of items) {
    try {
      // Data quality gate
      const dqState = validateDataQuality(item.data_quality_check, normalizedDataset.length);
      if (dqState === "suppress") {
        console.info(`[ScopedExecutor] Suppressing insight "${item.id}" — below min_threshold.`);
        continue;
      }

      // Topological sort of calculations
      const orderedKeys = topoSort(item.calculations);

      // Pass 1: per_record
      const derivedColumns = runPerRecordPass(normalizedDataset, item.calculations, orderedKeys);

      // Pass 2: period (HyperFormula)
      let resolvedCalcs: Record<string, number> = {};
      resolvedCalcs = runPeriodPass(
        normalizedDataset,
        derivedColumns,
        item.calculations,
        orderedKeys,
        resolvedCalcs,
        substituteContext
      );

      // Pass 3: derived (scalar-on-scalar)
      resolvedCalcs = runDerivedPass(item.calculations, orderedKeys, resolvedCalcs);

      // Severity evaluation (stats-aware)
      const severity = evaluateV3Severity(item.severity_logic, resolvedCalcs, dataStats);

      // Template resolution
      const nlCtx = { resolved: resolvedCalcs };
      const rawText = fillTemplate(item.statement_template, resolvedCalcs);
      const text = resolveNLTokens(rawText, nlCtx);

      const summary = item.summary_template
        ? resolveNLTokens(fillTemplate(item.summary_template, resolvedCalcs), nlCtx)
        : undefined;

      // Build KPI cards
      const overviewKpis: ResolvedKPI[] = (item.drill_down?.overview_kpis ?? []).map(kpi => ({
        key: kpi.key,
        label: kpi.label,
        highlighted: kpi.highlighted ?? false,
        value: resolvedCalcs[kpi.key] ?? null,
        formatted: kpi.key in resolvedCalcs ? formatValue(resolvedCalcs[kpi.key]) : "—",
      }));

      // Build calc trace
      const calcTrace: CalcTraceEntry[] = buildCalcTrace(item, resolvedCalcs);

      const result: InsightResult = {
        // v2 base fields
        id: item.id,
        category: item.category,
        severity,
        text,
        // v3 extensions
        group: item.group,
        priority_tag: item.priority_tag,
        severity_color: item.severity_color,
        summary,
        risk_callout: item.risk_callout,
        decision_callout: item.decision_callout,
        action_callout: item.action_callout,
        data_quality_state: dqState,
        resolvedMetrics: resolvedCalcs,
        drill_down: {
          breakdown_by: item.drill_down?.breakdown_by ?? "",
          trend_bucket: item.drill_down?.trend_bucket ?? "week",
          calcTrace,
          overviewKpis,
          breakdownData: item.drill_down?.breakdown_by ? runBreakdownEngine(item, normalizedDataset, { context: { reportStart, reportEnd, previousStart: prevStart, previousEnd: prevEnd } }) : [],
          trendData: item.visualization?.trend_metric && item.visualization?.date_field ? runTrendEngine(item, normalizedDataset, { reportStart, reportEnd }) : []
        },
        _plan: item,
        _dataset: normalizedDataset,
      };

      results.push(result);
    } catch (err) {
      console.warn(`[ScopedExecutor] Skipping insight "${item.id}":`, err);
    }
  }

  return results;
}
