/**
 * Trend Engine — Phase 4b (v3)
 *
 * Buckets dataset rows by day/week/month and aggregates a metric per bucket.
 * Returns chart-ready TrendPoint[] for the Trend tab.
 *
 * Steps:
 *   1. Filter dataset to report period (using visualization.date_field)
 *   2. Materialize per_record virtual fields
 *   3. Bucket rows by day/week/month
 *   4. For each bucket: aggregate trend_metric
 *   5. Generate human-readable labels
 */

import type { TrendPoint, AIInsightItem } from "../types";

const MAX_TREND_RECORDS = 5000;

// ─── Date Utilities ───────────────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getBucketKey(date: Date, bucket: "day" | "week" | "month"): string {
  switch (bucket) {
    case "day":
      return toIsoDate(date);
    case "week": {
      // ISO week start = Monday
      const d = new Date(date);
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      return `WK${String(getISOWeekNumber(date)).padStart(2, "0")}-${d.getFullYear()}`;
    }
    case "month":
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
}

function getBucketLabel(key: string, bucket: "day" | "week" | "month"): string {
  if (bucket === "day") {
    const d = new Date(key + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (bucket === "week") {
    const wk = key.split("-")[0].replace("WK", "");
    return `Wk ${parseInt(wk, 10)}`;
  }
  // month: "2026-04" → "Apr 2026"
  const [yr, mo] = key.split("-");
  const d = new Date(parseInt(yr, 10), parseInt(mo, 10) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getBucketRange(key: string, bucket: "day" | "week" | "month"): { start: string; end: string } {
  if (bucket === "day") return { start: key, end: key };

  if (bucket === "week") {
    // Parse the week number and year from "WK01-2026"
    const [wkPart, yearPart] = key.split("-");
    const wkNum = parseInt(wkPart.replace("WK", ""), 10);
    const year = parseInt(yearPart, 10);
    // ISO week 1 starts on first Thursday's Monday
    const jan4 = new Date(year, 0, 4);
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
    const weekStart = new Date(startOfWeek1);
    weekStart.setDate(startOfWeek1.getDate() + (wkNum - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return { start: toIsoDate(weekStart), end: toIsoDate(weekEnd) };
  }

  // month
  const [yr, mo] = key.split("-");
  const year = parseInt(yr, 10);
  const month = parseInt(mo, 10) - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

// ─── Per-Record Materialization ───────────────────────────────────────────────

function materializeRow(
  row: Record<string, unknown>,
  perRecordCalcs: Array<[string, { formula: string }]>
): Record<string, unknown> {
  const enriched: Record<string, unknown> = { ...row };
  for (const [key, calc] of perRecordCalcs) {
    try {
      const fieldNames = Object.keys(enriched);
      const vals = fieldNames.map(f => {
        const v = enriched[f];
        return typeof v === "number" ? v : parseFloat(String(v) || "0") || 0;
      });
      // eslint-disable-next-line no-new-func
      const fn = new Function(...fieldNames, `return (${calc.formula});`);
      const result = fn(...vals);
      enriched[key] = typeof result === "number" && isFinite(result) ? result : 0;
    } catch {
      enriched[key] = 0;
    }
  }
  return enriched;
}

// ─── Bucket Aggregation ───────────────────────────────────────────────────────

function aggregateBucket(
  rows: Record<string, unknown>[],
  metricKey: string
): number {
  let sum = 0;
  for (const row of rows) {
    const val = row[metricKey];
    const n = typeof val === "number" ? val : parseFloat(String(val) || "0");
    if (isFinite(n)) sum += n;
  }
  return sum;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface TrendOptions {
  reportStart?: string;
  reportEnd?: string;
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
 * Run the trend engine for a v3 insight.
 *
 * @param plan     v3 insight item with visualization config
 * @param dataset  Normalized dataset
 * @param opts     Date range context
 * @returns Sorted TrendPoint[] (chronological)
 */
export function runTrendEngine(
  plan: AIInsightItem,
  dataset: Record<string, unknown>[],
  opts?: TrendOptions
): TrendPoint[] {
  const viz = plan.visualization;
  if (!viz?.trend_metric || !viz?.date_field) return [];

  const trendMetric = viz.trend_metric;
  const dateFieldRaw = viz.date_field;
  const bucket = plan.drill_down?.trend_bucket ?? "week";

  const now = new Date();
  const defaultEnd = now.toISOString().split("T")[0];
  const defaultStart = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
  const reportStart = new Date(opts?.reportStart ?? defaultStart);
  const reportEnd = new Date(opts?.reportEnd ?? defaultEnd);

  const perRecordCalcs = Object.entries(plan.calculations).filter(([, c]) => c.scope === "per_record") as Array<[string, { formula: string }]>;

  // 1. Filter and materialize
  const buckets = new Map<string, Record<string, unknown>[]>();

  const workset = dataset.slice(0, MAX_TREND_RECORDS);
  const dateField = workset.length > 0 ? findActualKey(dateFieldRaw, workset[0]) : dateFieldRaw;

  for (const row of workset) {
    const rawDate = row[dateField];
    if (!rawDate) continue;
    const d = new Date(String(rawDate));
    if (isNaN(d.getTime())) continue;
    if (d < reportStart || d > reportEnd) continue;

    const key = getBucketKey(d, bucket);
    if (!buckets.has(key)) buckets.set(key, []);
    const enriched = perRecordCalcs.length ? materializeRow(row, perRecordCalcs) : row;
    buckets.get(key)!.push(enriched);
  }

  if (!buckets.size) return [];

  // 2. Aggregate per bucket and build TrendPoints
  // Resolve the actual metric key against the first row (normalized dataset keys may differ from AI plan)
  const firstRow = buckets.values().next().value?.[0];
  const actualMetricKey = firstRow ? findActualKey(trendMetric, firstRow) : trendMetric;
  const points: TrendPoint[] = [];
  for (const [key, rows] of buckets.entries()) {
    const value = aggregateBucket(rows, actualMetricKey);
    const label = getBucketLabel(key, bucket);
    const range = getBucketRange(key, bucket);
    points.push({ label, value, bucketStart: range.start, bucketEnd: range.end });
  }

  // 3. Sort chronologically by bucketStart
  points.sort((a, b) => a.bucketStart.localeCompare(b.bucketStart));

  return points;
}
