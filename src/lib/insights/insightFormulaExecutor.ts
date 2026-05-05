import HyperFormula from "hyperformula";
import type { AIInsightPlan, AIInsightItem, InsightResult, InsightSeverity } from "./types";
import { toSafeIdentifier } from "./fieldSchemaAdapter";

/**
 * Insight Formula Executor — ST-8
 *
 * THE PRIVACY-SAFE ENGINE: AI defines formulas; HyperFormula executes them on data.
 * AI NEVER receives actual dataset values.
 */

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

  const queue = keys.filter((k) => inDegree[k] === 0);
  const sorted: string[] = [];

  while (queue.length) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const dep of dependents[node] ?? []) {
      inDegree[dep]--;
      if (inDegree[dep] === 0) queue.push(dep);
    }
  }

  return sorted.length === keys.length ? sorted : keys;
}

// ─── Helper: indexToColumnLetter ──────────────────────────────────────────────

function indexToColumnLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

// ─── Pure Arithmetic Evaluation ──────────────────────────────────────────────

function evalArithmetic(
  formula: string,
  resolvedCalcs: Record<string, number>
): number | null {
  try {
    const paramNames = Object.keys(resolvedCalcs);
    const paramValues = Object.values(resolvedCalcs);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...paramNames, `return (${formula});`);
    const result = fn(...paramValues);
    return typeof result === "number" && !isNaN(result) ? result : null;
  } catch {
    return null;
  }
}

function isPureArithmetic(formula: string, calcKeys: string[]): boolean {
  let stripped = formula;
  for (const key of calcKeys) {
    stripped = stripped.replace(new RegExp(`\\b${key}\\b`, "g"), "0");
  }
  return /^[\d\s\+\-\*\/\(\)\.]+$/.test(stripped);
}

// ─── Template Fill ────────────────────────────────────────────────────────────

function fillTemplate(
  template: string,
  resolved: Record<string, number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in resolved) {
      const val = resolved[key];
      const formatted =
        Number.isInteger(val)
          ? val.toLocaleString()
          : val.toLocaleString(undefined, { maximumFractionDigits: 2 });
      return formatted;
    }
    return match;
  });
}

// ─── Severity Evaluation ─────────────────────────────────────────────────────

function evaluateSeverity(
  severityLogic: AIInsightItem["severity_logic"],
  resolved: Record<string, number>
): InsightSeverity {
  const tryCondition = (condition: string): boolean => {
    try {
      const paramNames = Object.keys(resolved);
      const paramValues = Object.values(resolved);

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
  };

  if (tryCondition(severityLogic.high)) return "high";
  if (tryCondition(severityLogic.medium)) return "medium";
  return "low";
}

// ─── Formula Handling Helpers ────────────────────────────────────────────────

function isRowLevelFormula(formula: string): boolean {
  const aggregateFunctions = ["SUM", "AVERAGE", "AVG", "MIN", "MAX", "COUNT", "SUMIFS", "COUNTIFS"];
  const upper = formula.toUpperCase();
  return !aggregateFunctions.some(fn => upper.includes(fn + "("));
}

function evalRowLevel(
  formula: string,
  dataset: Record<string, unknown>[],
  resolvedCalcs: Record<string, number>,
  derivedColumns: Record<string, number[]>
): number[] | null {
  try {
    const results: number[] = [];
    const fieldNames = Object.keys(dataset[0]);
    const derivedKeys = Object.keys(derivedColumns);
    const calcKeys = Object.keys(resolvedCalcs);

    const params = [...fieldNames, ...derivedKeys, ...calcKeys];
    // eslint-disable-next-line no-new-func
    const fn = new Function(...params, `return (${formula});`);

    for (let i = 0; i < dataset.length; i++) {
      const row = dataset[i];
      const args = [
        ...fieldNames.map(f => row[f]),
        ...derivedKeys.map(k => derivedColumns[k][i]),
        ...calcKeys.map(k => resolvedCalcs[k])
      ];
      const val = fn(...args);
      results.push(typeof val === "number" ? val : 0);
    }
    return results;
  } catch {
    return null;
  }
}

function evalWithHyperFormula(
  formula: string,
  dataset: Record<string, unknown>[],
  resolvedCalcs: Record<string, number>,
  derivedColumns: Record<string, number[]>
): number | null {
  try {
    if (!dataset.length) return null;

    const fieldNames = Object.keys(dataset[0]);
    const derivedKeys = Object.keys(derivedColumns);
    const scalarKeys = Object.keys(resolvedCalcs);

    const sheetData: (string | number | boolean | null)[][] = [];

    const headerRow = [...fieldNames, ...derivedKeys, ...scalarKeys];
    sheetData.push(headerRow);

    for (let i = 0; i < dataset.length; i++) {
      const row = dataset[i];
      const dataRow = [
        ...fieldNames.map(f => {
          const v = row[f];
          return (typeof v === "number" || typeof v === "boolean") ? v : String(v);
        }),
        ...derivedKeys.map(k => derivedColumns[k][i]),
        ...scalarKeys.map(k => resolvedCalcs[k])
      ];
      sheetData.push(dataRow);
    }

    // Add a dedicated formula evaluation row at the bottom
    const evalRow = new Array(headerRow.length).fill(null);
    sheetData.push(evalRow);
    const formulaRowIdx = sheetData.length - 1;

    let processedFormula = formula;
    const dataRowCount = dataset.length;

    // Map names to ranges/cells (e.g., "Quantity" -> "A2:A50")
    headerRow.forEach((name, colIdx) => {
      const colLetter = indexToColumnLetter(colIdx);
      const isScalar = scalarKeys.includes(name);

      if (isScalar) {
        // Scalar value cell reference (Row 2 is first data row)
        processedFormula = processedFormula.replace(new RegExp(`\\b${name}\\b`, "g"), `${colLetter}2`);
      } else {
        // Column range reference
        processedFormula = processedFormula.replace(new RegExp(`\\b${name}\\b`, "g"), `${colLetter}2:${colLetter}${dataRowCount + 1}`);
      }
    });

    sheetData[formulaRowIdx][0] = `=${processedFormula}`;

    const hf = HyperFormula.buildFromSheets(
      { Sheet1: sheetData as any },
      { 
        licenseKey: "gpl-v3",
        dateFormats: ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"]
      }
    );

    const result = hf.getCellValue({ sheet: 0, row: formulaRowIdx, col: 0 });
    hf.destroy();

    if (typeof result === "number") return result;
    if (typeof result === "string") {
      const parsed = parseFloat(result);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  } catch (err) {
    console.warn("[InsightExecutor] Aggregate evaluation failed:", err, formula);
    return null;
  }
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export interface InsightContext {
  reportStart?: string; // ISO Date YYYY-MM-DD
  reportEnd?: string;   // ISO Date YYYY-MM-DD
}

export function executeInsightPlan(
  plan: AIInsightPlan,
  dataset: Record<string, unknown>[],
  context?: InsightContext
): InsightResult[] {
  const results: InsightResult[] = [];
  if (!dataset.length) return [];

  const now = new Date();
  const defaultEnd = now.toISOString().split("T")[0];
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const reportStartStr = context?.reportStart || defaultStart;
  const reportEndStr = context?.reportEnd || defaultEnd;

  const startTs = new Date(reportStartStr).getTime();
  const endTs = new Date(reportEndStr).getTime();
  const midTs = startTs + (endTs - startTs) / 2;
  const reportMidpointStr = new Date(midTs).toISOString().split("T")[0];

  // 1. Create a fully normalized dataset:
  // - Keys are converted to safe camelCase identifiers (matching FieldSchema names sent to AI)
  // - Dates are normalized to ISO strings if possible
  const normalizedDataset = dataset.map(row => {
    const newRow: Record<string, any> = {};
    for (const [key, val] of Object.entries(row)) {
      const safeKey = toSafeIdentifier(key);
      let finalVal = val;

      // Basic Date Normalization
      if (typeof val === "string" && (key.toLowerCase().includes("date") || /^\d{4}-\d{2}-\d{2}/.test(val))) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          finalVal = d.toISOString().split("T")[0]; // YYYY-MM-DD
        }
      }
      
      newRow[safeKey] = finalVal;
    }
    return newRow;
  });

  for (const item of plan.insights) {
    try {
      const orderedKeys = topoSort(item.calculations);
      const resolvedCalcs: Record<string, number> = {};
      const derivedColumns: Record<string, number[]> = {};

      let executionFailed = false;

      for (const key of orderedKeys) {
        const calc = item.calculations[key];
        if (!calc) continue;

        let formulaStr = calc.formula;
        formulaStr = formulaStr.replace(/\bREPORT_START\b/g, `"${reportStartStr}"`);
        formulaStr = formulaStr.replace(/\bREPORT_END\b/g, `"${reportEndStr}"`);
        formulaStr = formulaStr.replace(/\bREPORT_MIDPOINT\b/g, `"${reportMidpointStr}"`);

        let value: number | null = null;

        if (isPureArithmetic(formulaStr, Object.keys(resolvedCalcs))) {
          value = evalArithmetic(formulaStr, resolvedCalcs);
        } 
        else if (isRowLevelFormula(formulaStr)) {
          const columnValues = evalRowLevel(formulaStr, normalizedDataset, resolvedCalcs, derivedColumns);
          if (columnValues) {
            derivedColumns[key] = columnValues;
            // Row-level formulas don't produce a single scalar value for the template,
            // they produce a virtual column for subsequent aggregations.
            continue; 
          }
        }
        else {
          value = evalWithHyperFormula(formulaStr, normalizedDataset, resolvedCalcs, derivedColumns);
        }

        if (value === null) {
          console.warn(`[InsightExecutor] Insight "${item.id}" calc "${key}" returned null. Skipping.`);
          executionFailed = true;
          break;
        }

        resolvedCalcs[key] = value;
      }

      if (executionFailed) continue;

      const text = fillTemplate(item.statement_template, resolvedCalcs);
      const severity = evaluateSeverity(item.severity_logic, resolvedCalcs);

      results.push({
        id: item.id,
        category: item.category,
        severity,
        text,
      });
    } catch (err) {
      console.warn(`[InsightExecutor] Skipping insight "${item.id}" due to error:`, err);
    }
  }

  return results;
}
