/**
 * Breakdown Engine — Phase 4a (v3)
 *
 * Partitions the dataset by a dimension field (breakdown_by),
 * runs the period-scope aggregations for each group,
 * computes share_pct, and sorts the result.
 *
 * IMPORTANT: This engine only groups on dimension fields.
 * All computation is still driven by the AI-defined formulas.
 */

import HyperFormula from "hyperformula";
import type { BreakdownRow, AIInsightItem, AICalculation } from "../types";

const MAX_BREAKDOWN_RECORDS = 5000;

// ─── Column Letter Utility ────────────────────────────────────────────────────

function indexToColumnLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

// ─── Per-Record Materialization ───────────────────────────────────────────────

function materializePerRecord(
  dataset: Record<string, unknown>[],
  calcs: Record<string, AICalculation>
): Record<string, unknown>[] {
  const perRecordCalcs = Object.entries(calcs).filter(([, c]) => c.scope === "per_record");
  if (!perRecordCalcs.length) return dataset;

  return dataset.map(row => {
    const enriched: Record<string, unknown> = { ...row };
    for (const [key, calc] of perRecordCalcs) {
      try {
        const fieldNames = Object.keys(enriched);
        const fieldVals = fieldNames.map(f => {
          const v = enriched[f];
          return typeof v === "number" ? v : parseFloat(String(v) || "0") || 0;
        });
        // eslint-disable-next-line no-new-func
        const fn = new Function(...fieldNames, `return (${calc.formula});`);
        const result = fn(...fieldVals);
        enriched[key] = typeof result === "number" && isFinite(result) ? result : 0;
      } catch {
        enriched[key] = 0;
      }
    }
    return enriched;
  });
}

// ─── Period Aggregation via HyperFormula ─────────────────────────────────────

function evalPeriodCalc(
  formula: string,
  dataset: Record<string, unknown>[],
  context: GroupContext
): number | null {
  try {
    if (!dataset.length) return 0;
    const fieldNames = Object.keys(dataset[0]);
    const scalarKeys = Object.keys(context.scalars);
    const headerRow = [...fieldNames, ...scalarKeys];

    const sheetData: (string | number | boolean | null)[][] = [headerRow];
    for (const row of dataset) {
      sheetData.push([
        ...fieldNames.map(f => {
          const v = row[f];
          if (typeof v === "number" || typeof v === "boolean") return v;
          if (typeof v === "string" && v.trim() !== "") {
            const num = Number(v);
            if (!isNaN(num)) return num;
          }
          return String(v ?? "");
        }),
        ...scalarKeys.map(k => context.scalars[k]),
      ]);
    }

    // Formula evaluation row
    const evalRow = new Array(headerRow.length).fill(null);
    sheetData.push(evalRow);
    const formulaRowIdx = sheetData.length - 1;
    const dataRowCount = dataset.length;

    let processedFormula = formula;
    headerRow.forEach((name, colIdx) => {
      const col = indexToColumnLetter(colIdx);
      const isScalar = scalarKeys.includes(name);
      processedFormula = processedFormula.replace(
        new RegExp(`\\b${name}\\b`, "g"),
        isScalar ? `${col}2` : `${col}2:${col}${dataRowCount + 1}`
      );
    });

    sheetData[formulaRowIdx][0] = `=${processedFormula}`;

    const hf = HyperFormula.buildFromSheets(
      { Sheet1: sheetData as never },
      {
        licenseKey: "gpl-v3",
        dateFormats: ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"],
        maxRows: 200000,
      }
    );
    const result = hf.getCellValue({ sheet: 0, row: formulaRowIdx, col: 0 });
    hf.destroy();

    if (typeof result === "number") return result;
    if (typeof result === "string") { const p = parseFloat(result); return isNaN(p) ? null : p; }
    return null;
  } catch {
    return null;
  }
}

interface GroupContext {
  scalars: Record<string, number>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface BreakdownOptions {
  context?: {
    reportStart?: string;
    reportEnd?: string;
    previousStart?: string;
    previousEnd?: string;
  };
  /** From visualization.limit — defaults to 10 */
  limit?: number;
}

function findActualKey(target: string | undefined, row: Record<string, unknown>): string {
  if (!target) return "";
  // Exact match first
  if (row && row[target] !== undefined) return target;
  if (!row) return target;
  // Normalize: lowercase, strip spaces AND underscores for resilient matching
  // e.g. "Supplier Name" → "suppliername" matches "supplier_name" → "suppliername"
  const normalize = (s: string) => s.toLowerCase().replace(/[\s_]/g, '');
  const normalizedTarget = normalize(target);
  const key = Object.keys(row).find(k => normalize(k) === normalizedTarget);
  return key || target;
}

/**
 * Run the breakdown engine for a v3 insight.
 *
 * @param plan     v3 insight item with drill_down.breakdown_by defined
 * @param dataset  Normalized (field names are safe camelCase), limited to MAX_BREAKDOWN_RECORDS
 * @param opts     Optional context (date ranges) and display limit
 * @returns  Sorted BreakdownRow[] with share_pct filled
 */
export function runBreakdownEngine(
  plan: AIInsightItem,
  dataset: Record<string, unknown>[],
  opts?: BreakdownOptions
): BreakdownRow[] {
  const breakdownFieldRaw = plan.drill_down?.breakdown_by;

  // ─── DIAGNOSTIC LOGGING ───────────────────────────────────────────────────
  console.group(`[BreakdownEngine] plan="${plan.id}"`);
  console.log('[BreakdownEngine] breakdown_by (raw from plan):', breakdownFieldRaw);
  console.log('[BreakdownEngine] dataset.length:', dataset.length);
  if (dataset.length > 0) {
    console.log('[BreakdownEngine] dataset[0] keys:', Object.keys(dataset[0]));
    console.log('[BreakdownEngine] dataset[0] sample:', JSON.stringify(dataset[0]).slice(0, 300));
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (!breakdownFieldRaw) {
    console.warn('[BreakdownEngine] No breakdown_by field defined — returning []');
    console.groupEnd();
    return [];
  }

  const limit = opts?.limit ?? plan.visualization?.limit ?? 10;
  const workset = dataset.slice(0, MAX_BREAKDOWN_RECORDS);

  const breakdownField = workset.length > 0 ? findActualKey(breakdownFieldRaw, workset[0]) : breakdownFieldRaw;
  console.log(`[BreakdownEngine] breakdown_by resolved: "${breakdownFieldRaw}" → "${breakdownField}"`);
  if (breakdownField === breakdownFieldRaw && workset.length > 0 && workset[0][breakdownField] === undefined) {
    console.error('[BreakdownEngine] ⚠️  FIELD NOT FOUND in dataset row! All group keys will be "(blank)".');
  }

  // Build context scalars (report period constants)
  const ctx = opts?.context ?? {};
  const now = new Date();
  const defaultEnd = now.toISOString().split("T")[0];
  const defaultStart = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];

  const scalars: Record<string, number> = {};
  // Date context is injected via string replacement into formulas later

  // Apply date context to formulas
  const substituteContext = (formula: string): string =>
    formula
      .replace(/\bREPORT_START\b/g, `"${ctx.reportStart ?? defaultStart}"`)
      .replace(/\bREPORT_END\b/g, `"${ctx.reportEnd ?? defaultEnd}"`)
      .replace(/\bPREV_START\b/g, `"${ctx.previousStart ?? defaultStart}"`)
      .replace(/\bPREV_END\b/g, `"${ctx.previousEnd ?? defaultEnd}"`)
      .replace(/\bREPORT_MIDPOINT\b/g, () => {
        const s = new Date(ctx.reportStart ?? defaultStart).getTime();
        const e = new Date(ctx.reportEnd ?? defaultEnd).getTime();
        return `"${new Date(s + (e - s) / 2).toISOString().split("T")[0]}"`;
      });

  // 1. Partition dataset by breakdown field
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of workset) {
    const groupKey = String(row[breakdownField] ?? "(blank)");
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push(row);
  }
  console.log(`[BreakdownEngine] Groups found: ${groups.size}`, [...groups.keys()].slice(0, 10));
  if (groups.size === 0 || (groups.size === 1 && groups.has('(blank)'))) {
    console.error('[BreakdownEngine] ⚠️  All rows resolved to "(blank)" — field lookup failed completely.');
  }

  // 2. For each group, materialize per_record fields, then run period calcs
  const periodCalcs = Object.entries(plan.calculations).filter(([, c]) => c.scope === "period");
  const primaryMetricKey =
    plan.visualization?.breakdown_metric ??
    plan.visualization?.trend_metric ??
    (periodCalcs[0]?.[0] ?? "");

  const rows: BreakdownRow[] = [];
  let total = 0;

  for (const [groupKey, groupRows] of groups.entries()) {
    const enriched = materializePerRecord(groupRows, plan.calculations);

    const metrics: Record<string, number> = {};
    const groupScalars = { ...scalars };
    const groupCtx: GroupContext = { scalars: groupScalars };

    for (const [key, calc] of periodCalcs) {
      const formula = substituteContext(calc.formula);
      // Inject already-resolved scalars
      const resolvedFormula = Object.keys(metrics).reduce(
        (f, k) => f.replace(new RegExp(`\\b${k}\\b`, "g"), String(metrics[k])),
        formula
      );
      const val = evalPeriodCalc(resolvedFormula, enriched, groupCtx);
      metrics[key] = val ?? 0;
      groupScalars[key] = val ?? 0;
    }

    const primaryVal = metrics[primaryMetricKey] ?? 0;
    total += primaryVal;
    rows.push({ groupKey, metrics, share_pct: 0 });
  }

  // 3. Compute share_pct
  for (const row of rows) {
    row.share_pct = total > 0 ? ((row.metrics[primaryMetricKey] ?? 0) / total) * 100 : 0;
  }

  // 4. Sort by primary metric descending and apply limit
  rows.sort((a, b) => (b.metrics[primaryMetricKey] ?? 0) - (a.metrics[primaryMetricKey] ?? 0));

  const finalRows = rows.slice(0, limit);
  console.log(`[BreakdownEngine] Returning ${finalRows.length} rows. primaryMetricKey="${primaryMetricKey}"`, finalRows.slice(0, 3));
  console.groupEnd();
  return finalRows;
}
