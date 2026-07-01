// ---------------------------------------------------------------------------
// dateBreakdown.ts — Shared contract for the Date Breakdown feature.
//
// A Date Breakdown injects a synthetic outermost GROUP BY level that buckets
// a date column by Month or Quarter.  This module is the single source of
// truth shared by:
//   • baseCte.ts   — emits the bucket SELECT column
//   • builders.ts  — threads the param into each generator
//   • structureAdapter.ts (Phase B) — formats bucket labels for display
//   • sqlReportEngine.ts  (Phase B) — level-count and runner wiring
//
// All exports are PURE — no side effects, no I/O.
// ---------------------------------------------------------------------------

import type { ReportConfig, GroupByField } from '../reportConfigTypes';
import { resolveBareField } from './baseCte';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Describes an active date breakdown.  Produced by the API layer (Phase B)
 * from the request body and threaded into every SQL builder as an optional
 * trailing parameter.
 */
export interface DateBreakdown {
  /** Logical table key of the date column (must exist in SqlSetup). */
  table: string;
  /** Logical field key of the date column (must exist in the table). */
  field: string;
  /** Granularity of the bucket. */
  interval: 'Month' | 'Quarter';
}

// ---------------------------------------------------------------------------
// Synthetic-level identity constants
// ---------------------------------------------------------------------------

/**
 * Sentinel logical table key used for the synthetic breakdown GroupByField.
 * Never appears in SqlSetup.tables — it is intercepted before any resolveField
 * call in both baseCte (which uses the real date table/field) and
 * structureAdapter (Phase B).
 */
export const BREAKDOWN_TABLE = '__breakdown';

/**
 * Sentinel logical field key for the synthetic breakdown GroupByField.
 * The SELECT alias emitted into `base` is `"__breakdown.period"`.
 */
export const BREAKDOWN_FIELD = 'period';

// ---------------------------------------------------------------------------
// SQL bucket expressions
// ---------------------------------------------------------------------------

/**
 * Build the SQLite expression that converts a normalised date SQL expression
 * (`colSql`) into a chronologically sortable period key string.
 *
 * @param colSql   An already-normalised date SQL expression.  Callers should
 *                 wrap the physical column with `normalizeDateCol(qualifiedColumn(…))`
 *                 before passing it here.
 * @param interval `'Month'` → `"2025-01"` (zero-padded, sorts lexicographically)
 *                 `'Quarter'` → `"2025-Q1"` (year prefix keeps chronological order)
 *
 * @example
 *   buildBucketExpr("CASE WHEN … END", 'Month')
 *   // → "strftime('%Y-%m', CASE WHEN … END)"
 *
 *   buildBucketExpr("CASE WHEN … END", 'Quarter')
 *   // → "strftime('%Y', CASE WHEN … END) || '-Q' || ((CAST(strftime('%m', CASE WHEN … END) AS INTEGER) + 2) / 3)"
 */
export function buildBucketExpr(colSql: string, interval: 'Month' | 'Quarter'): string {
  if (interval === 'Month') {
    return `strftime('%Y-%m', ${colSql})`;
  }
  // Quarter: year + '-Q' + integer quarter number (1–4).
  // Month number → quarter: (month + 2) / 3 using integer division.
  // e.g. month 1 → (1+2)/3 = 1, month 3 → (3+2)/3 = 1, month 4 → (4+2)/3 = 2, month 12 → (12+2)/3 = 4.
  return (
    `strftime('%Y', ${colSql})` +
    ` || '-Q' ||` +
    ` ((CAST(strftime('%m', ${colSql}) AS INTEGER) + 2) / 3)`
  );
}

// ---------------------------------------------------------------------------
// Display label formatting
// ---------------------------------------------------------------------------

/**
 * Convert a raw bucket key (produced by `buildBucketExpr`) into a
 * human-readable label for display in the report UI.
 *
 * @param key      Raw period key from the database (e.g. `"2025-01"`, `"2025-Q1"`).
 * @param interval Granularity that produced the key.
 * @returns        Human-readable label (`"January 2025"`, `"Q1 2025"`).
 *                 Returns `key` unchanged when the pattern does not match.
 *
 * @example
 *   formatBucketLabel('2025-01', 'Month')   // → "January 2025"
 *   formatBucketLabel('2025-Q3', 'Quarter') // → "Q3 2025"
 *   formatBucketLabel('bad-data', 'Month')  // → "bad-data"
 */
export function formatBucketLabel(key: string, interval: 'Month' | 'Quarter'): string {
  if (interval === 'Month') {
    // Expected pattern: YYYY-MM
    const match = /^(\d{4})-(\d{2})$/.exec(key);
    if (!match) return key;
    const [, year, monthStr] = match;
    const monthIndex = parseInt(monthStr, 10) - 1; // 0-based for Date constructor
    if (monthIndex < 0 || monthIndex > 11) return key;
    const monthName = new Date(2000, monthIndex, 1).toLocaleString('en-US', { month: 'long' });
    return `${monthName} ${year}`;
  }

  // Quarter — expected pattern: YYYY-QN
  const match = /^(\d{4})-Q([1-4])$/.exec(key);
  if (!match) return key;
  const [, year, quarter] = match;
  return `Q${quarter} ${year}`;
}

/**
 * Inverse of `formatBucketLabel`: convert a human-readable label back into the
 * raw sortable period key that the database stores in `"__breakdown.period"`.
 * Used by the drill-down path, where the group value carried in the UI is the
 * formatted label but the WHERE filter must match the raw key.
 *
 * @param label    A formatted label (`"January 2025"`, `"Q1 2025"`) — or an
 *                 already-raw key, which is returned unchanged.
 * @param interval Granularity that produced the label.
 * @returns        Raw period key (`"2025-01"`, `"2025-Q1"`). Returns `label`
 *                 unchanged when it matches no known pattern.
 *
 * @example
 *   parseBucketLabel('January 2025', 'Month')   // → "2025-01"
 *   parseBucketLabel('Q3 2025', 'Quarter')      // → "2025-Q3"
 *   parseBucketLabel('2025-01', 'Month')        // → "2025-01" (already raw)
 */
export function parseBucketLabel(label: string, interval: 'Month' | 'Quarter'): string {
  const trimmed = label.trim();
  if (interval === 'Month') {
    // Already a raw key?
    if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
    // "Month YYYY" → "YYYY-MM"
    const match = /^([A-Za-z]+)\s+(\d{4})$/.exec(trimmed);
    if (!match) return label;
    const [, monthName, year] = match;
    const monthIndex = MONTH_NAMES.indexOf(monthName.toLowerCase());
    if (monthIndex < 0) return label;
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  }

  // Quarter — already a raw key?
  if (/^\d{4}-Q[1-4]$/.test(trimmed)) return trimmed;
  // "QN YYYY" → "YYYY-QN"
  const match = /^Q([1-4])\s+(\d{4})$/.exec(trimmed);
  if (!match) return label;
  const [, quarter, year] = match;
  return `${year}-Q${quarter}`;
}

/** Lowercased English month names, index 0 = January (for parseBucketLabel). */
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

// ---------------------------------------------------------------------------
// Synthetic GroupByField
// ---------------------------------------------------------------------------

/**
 * Construct the synthetic outermost GroupByField that represents the date
 * breakdown level.  The returned object uses the sentinel `BREAKDOWN_TABLE`
 * and `BREAKDOWN_FIELD` so downstream level-iteration loops reference the
 * bucket column alias emitted by `buildBaseCte`.
 *
 * `group_total` is populated from the report's `summary_fields`, resolved to
 * concrete `{table, field}` pairs via `resolveBareField`.  This ensures each
 * period subtotal row shows the same totals that the report-level summary
 * would show.  Unresolvable or calculated summary fields are silently skipped.
 *
 * @param config   Full report configuration (not mutated).
 */
export function syntheticGroupLevel(config: ReportConfig): GroupByField {
  // Resolve summary_fields → {table, field} pairs for group_total.
  const groupTotal: Array<{ table: string; field: string }> = [];
  for (const bareField of config.summary_fields ?? []) {
    const resolved = resolveBareField(config, bareField);
    // Only include concrete {table, field} results — skip calculated fields
    // and unresolvable names.
    if (resolved !== null && !('calculated' in resolved)) {
      groupTotal.push({ table: resolved.table, field: resolved.field });
    }
  }

  return {
    table: BREAKDOWN_TABLE,
    field: BREAKDOWN_FIELD,
    sort_order: 'asc',
    display: [],
    group_total: groupTotal,
  };
}

// ---------------------------------------------------------------------------
// Effective group levels
// ---------------------------------------------------------------------------

/**
 * Return the ordered list of GroupByField levels that query builders should
 * use.  When a date breakdown is active, the synthetic breakdown level is
 * prepended as level 0, shifting all real levels down by one.
 *
 * This is the single place that computes the effective stack — builders,
 * structureAdapter, and the engine all call this instead of reading
 * `config.group_by_fields` directly when a breakdown may be present.
 *
 * @param config        Full report configuration.
 * @param dateBreakdown Optional active breakdown; omit (or pass `undefined`)
 *                      for the normal non-breakdown path.
 */
export function effectiveGroupLevels(
  config: ReportConfig,
  dateBreakdown?: DateBreakdown,
): GroupByField[] {
  const realLevels = Object.values(config.group_by_fields ?? {});
  if (!dateBreakdown) return realLevels;
  return [syntheticGroupLevel(config), ...realLevels];
}

// ---------------------------------------------------------------------------
// Predicate helper (used by Phase B: structureAdapter)
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the given group-field descriptor refers to the synthetic
 * breakdown level rather than a real config field.  Phase B uses this to
 * decide whether to call `formatBucketLabel` on the value.
 */
export function isSyntheticBreakdownField(g: { table: string; field: string }): boolean {
  return g.table === BREAKDOWN_TABLE && g.field === BREAKDOWN_FIELD;
}
