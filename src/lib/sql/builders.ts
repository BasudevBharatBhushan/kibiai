// ---------------------------------------------------------------------------
// Generators 1–4 — query builders over the shared `base` CTE.
//
// Each builder calls buildBaseCte(config, setup) to obtain the
// `WITH base AS ( … )` prefix + its filter params, then composes an outer
// query that selects `FROM base`. Columns inside `base` are exposed under the
// alias `"Table.Field"` (calc fields: `"calculated.<name>"`), so the outer
// query references them by that exact quoted token.
//
// Param ordering: base (filter) params come first; any group-filter / paging
// params are appended AFTER, in left-to-right `?` order.
//
// SQLite dialect, `?` positional params, identifiers via the allow-list only.
// Pure / deterministic.
// ---------------------------------------------------------------------------

import type { ReportConfig, GroupByField, SortField } from '../reportConfigTypes';
import type { SqlSetup, SqlQuery } from './types';
import { columnAlias } from './identifiers';
import { buildBaseCte, resolveBareField } from './baseCte';
import { calculatedAlias } from './formulaToSql';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Reference to a `base` column from an outer query. Inside `base` every column
 * is aliased `"Table.Field"`, so the outer reference is simply that quoted
 * token (a column name in the `base` derived table).
 */
function baseCol(table: string, field: string): string {
  return columnAlias(table, field);
}

function baseCalcCol(fieldName: string): string {
  return calculatedAlias(fieldName);
}

/**
 * Resolve a bare field name (summary_fields / body_sort_order) to its `base`
 * column reference, or throw if it cannot be located in the config.
 */
function resolveBaseColumn(config: ReportConfig, bareField: string): string {
  const resolved = resolveBareField(config, bareField);
  if (resolved === null) {
    throw new Error(
      `builders: field "${bareField}" is not referenced by any report column, ` +
        `group, or calculated field and cannot be resolved`,
    );
  }
  if ('calculated' in resolved) {
    return baseCalcCol(resolved.calculated);
  }
  return baseCol(resolved.table, resolved.field);
}

/** Ordered list of group-by levels (object insertion order). */
function groupLevels(config: ReportConfig): GroupByField[] {
  return Object.values(config.group_by_fields ?? {});
}

interface GroupFilterEntry {
  table: string;
  field: string;
  value: unknown;
}

/**
 * Build the optional `WHERE <base col> = ?` clause from a group filter, plus
 * the matching params. Empty array → no clause, no params.
 */
function buildGroupFilterWhere(groupFilter?: GroupFilterEntry[]): {
  sql: string;
  params: unknown[];
} {
  if (!groupFilter || groupFilter.length === 0) {
    return { sql: '', params: [] };
  }
  const clauses: string[] = [];
  const params: unknown[] = [];
  for (const gf of groupFilter) {
    clauses.push(`${baseCol(gf.table, gf.field)} = ?`);
    params.push(gf.value);
  }
  return { sql: `WHERE ${clauses.join(' AND ')}`, params };
}

// ---------------------------------------------------------------------------
// Generator 1 — group aggregation (one call per level)
// ---------------------------------------------------------------------------

/**
 * SELECT the group field(s) up to and including `level` (0-based), each
 * level's `display` columns, `COUNT(*) AS "row_count"`, and
 * `COALESCE(SUM(<total>),0)` for every `group_total` at the deepest selected
 * level. GROUP BY the group columns up to `level`; ORDER BY them using each
 * level's `sort_order`.
 *
 * SQLite has no ROLLUP, so callers invoke this once per level to build the
 * nested header/total rows.
 */
export function buildGroupAggregationQuery(
  config: ReportConfig,
  setup: SqlSetup,
  level: number,
): SqlQuery {
  const base = buildBaseCte(config, setup);
  const levels = groupLevels(config);

  if (levels.length === 0) {
    throw new Error('buildGroupAggregationQuery: config has no group_by_fields');
  }
  if (level < 0 || level >= levels.length) {
    throw new Error(
      `buildGroupAggregationQuery: level ${level} out of range (0..${levels.length - 1})`,
    );
  }

  const selected = levels.slice(0, level + 1);

  const selectParts: string[] = [];
  const groupByParts: string[] = [];
  const orderByParts: string[] = [];

  for (const g of selected) {
    const gc = baseCol(g.table, g.field);
    selectParts.push(gc);
    groupByParts.push(gc);
    const dir = g.sort_order === 'desc' ? 'DESC' : 'ASC';
    orderByParts.push(`${gc} ${dir}`);
  }

  // Display columns for the selected levels (aggregated via MIN so they are
  // valid under GROUP BY; display fields are functionally dependent on the
  // group key in practice).
  for (const g of selected) {
    for (const d of g.display ?? []) {
      selectParts.push(`MIN(${baseCol(d.table, d.field)}) AS ${baseCol(d.table, d.field)}`);
    }
  }

  selectParts.push('COUNT(*) AS "row_count"');

  // Group totals for the deepest selected level.
  const deepest = selected[selected.length - 1];
  for (const t of deepest.group_total ?? []) {
    const tc = baseCol(t.table, t.field);
    selectParts.push(`COALESCE(SUM(${tc}), 0) AS ${tc}`);
  }

  const sql =
    `${base.cteSql} ` +
    `SELECT ${selectParts.join(', ')} FROM base ` +
    `GROUP BY ${groupByParts.join(', ')} ` +
    `ORDER BY ${orderByParts.join(', ')}`;

  return { sql, params: [...base.params] };
}

// ---------------------------------------------------------------------------
// Generator 2 — count
// ---------------------------------------------------------------------------

/**
 * `SELECT COUNT(*) AS "total_rows" FROM base` with an optional group filter.
 * Drives the 30k drill-down / expand-all warning.
 */
export function buildCountQuery(
  config: ReportConfig,
  setup: SqlSetup,
  groupFilter?: GroupFilterEntry[],
): SqlQuery {
  const base = buildBaseCte(config, setup);
  const gf = buildGroupFilterWhere(groupFilter);

  let sql = `${base.cteSql} SELECT COUNT(*) AS "total_rows" FROM base`;
  if (gf.sql) sql += ` ${gf.sql}`;

  return { sql, params: [...base.params, ...gf.params] };
}

// ---------------------------------------------------------------------------
// Generator 3 — detail (flat body rows)
// ---------------------------------------------------------------------------

/**
 * `SELECT * FROM base` with an optional group filter, ordered by the group
 * columns then `body_sort_order`. LIMIT/OFFSET are emitted only when provided
 * (V1 callers omit them; supported for future server-side pagination).
 */
export function buildDetailQuery(
  config: ReportConfig,
  setup: SqlSetup,
  groupFilter?: GroupFilterEntry[],
  limit?: number,
  offset?: number,
): SqlQuery {
  const base = buildBaseCte(config, setup);
  const gf = buildGroupFilterWhere(groupFilter);

  const orderByParts: string[] = [];

  // Group columns first (preserve nesting order).
  for (const g of groupLevels(config)) {
    const dir = g.sort_order === 'desc' ? 'DESC' : 'ASC';
    orderByParts.push(`${baseCol(g.table, g.field)} ${dir}`);
  }

  // Then body_sort_order.
  for (const s of config.body_sort_order ?? ([] as SortField[])) {
    const dir = s.sort_order === 'desc' ? 'DESC' : 'ASC';
    orderByParts.push(`${resolveBaseColumn(config, s.field)} ${dir}`);
  }

  let sql = `${base.cteSql} SELECT * FROM base`;
  if (gf.sql) sql += ` ${gf.sql}`;
  if (orderByParts.length > 0) sql += ` ORDER BY ${orderByParts.join(', ')}`;

  const params: unknown[] = [...base.params, ...gf.params];

  if (limit !== undefined) {
    sql += ` LIMIT ?`;
    params.push(limit);
  }
  if (offset !== undefined) {
    // OFFSET is only meaningful alongside LIMIT in SQLite; emit a guard LIMIT
    // of -1 (unlimited) when an offset is supplied without a limit.
    if (limit === undefined) {
      sql += ` LIMIT -1`;
    }
    sql += ` OFFSET ?`;
    params.push(offset);
  }

  return { sql, params };
}

// ---------------------------------------------------------------------------
// Generator 4 — grand summary
// ---------------------------------------------------------------------------

/**
 * One aggregate row over `summary_fields`:
 * `SELECT COALESCE(SUM(<col>),0) AS <col> [, …] FROM base`.
 * With no summary fields, selects a single `COUNT(*)` so the query is valid.
 */
export function buildGrandSummaryQuery(config: ReportConfig, setup: SqlSetup): SqlQuery {
  const base = buildBaseCte(config, setup);

  const summaryFields = config.summary_fields ?? [];
  const selectParts: string[] = [];

  for (const f of summaryFields) {
    const col = resolveBaseColumn(config, f);
    selectParts.push(`COALESCE(SUM(${col}), 0) AS ${col}`);
  }

  if (selectParts.length === 0) {
    selectParts.push('COUNT(*) AS "total_rows"');
  }

  const sql = `${base.cteSql} SELECT ${selectParts.join(', ')} FROM base`;

  return { sql, params: [...base.params] };
}
