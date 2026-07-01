// ---------------------------------------------------------------------------
// Generator 0 — the shared base-CTE builder.
//
// Produces `WITH base AS ( SELECT <resolved cols> FROM <primary> <JOINs>
// WHERE <filters/date-ranges> )`. Every other generator selects FROM base.
//
//   - FROM / JOIN graph comes from `config.db_defination`, ordered by
//     `fetch_order` (fetch_order === 1 is the FROM table). Each later entry is
//     an INNER/LEFT JOIN (per `join_type`) on
//       <primary alias>.<source> = <joined alias>.<target>.
//   - SELECT columns are every field referenced anywhere in the config
//     (report_columns, group_by_fields field/display/group_total,
//     summary_fields, body_sort_order, and calc-field dependencies), plus the
//     compiled expression for each calculated field. De-duplicated, each
//     aliased `<table>.<field>` (calc fields → `calculated.<name>`).
//   - WHERE translates `filters` and `date_range_fields` into parameterized
//     predicates that mirror the FileMaker operator semantics in
//     /api/generate-report (see convertOperator in utility.ts). Every value is
//     a bound `?`.
//
// All identifiers go through the allow-list helpers. Pure / deterministic.
// ---------------------------------------------------------------------------

import type {
  ReportConfig,
  DbDefinition,
  GroupByField,
  ReportColumn,
} from '../reportConfigTypes';
import type { SqlSetup } from './types';
import {
  resolveTable,
  resolveField,
  qualifiedColumn,
  columnAlias,
  quoteIdent,
} from './identifiers';
import { compileFormula, calculatedAlias } from './formulaToSql';

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface BaseCteResult {
  /** The CTE text, e.g. `WITH base AS ( SELECT … )` (no trailing semicolon). */
  cteSql: string;
  /** Filter / date-range params, in left-to-right order of `?` appearance. */
  params: unknown[];
  /** The selected column aliases (the quoted alias tokens, in SELECT order). */
  selectedColumns: string[];
}

// ---------------------------------------------------------------------------
// Logical column key helper
// ---------------------------------------------------------------------------

interface ColRef {
  table: string;
  field: string;
}

function colKey(table: string, field: string): string {
  return `${table} ${field}`;
}

// ---------------------------------------------------------------------------
// FROM / JOIN graph
// ---------------------------------------------------------------------------

interface JoinPlan {
  /** Logical table key of the FROM table (fetch_order === 1). */
  fromTable: string;
  /** Ordered JOIN clauses (already fully-resolved SQL fragments). */
  joinClauses: string[];
}

function buildJoinPlan(config: ReportConfig, setup: SqlSetup): JoinPlan {
  const defs: DbDefinition[] = [...config.db_defination].sort(
    (a, b) => a.fetch_order - b.fetch_order,
  );

  if (defs.length === 0) {
    throw new Error('buildBaseCte: db_defination must contain at least one entry');
  }

  const first = defs[0];
  if (first.fetch_order !== 1) {
    throw new Error(
      `buildBaseCte: the lowest fetch_order must be 1 (FROM table); got ${first.fetch_order}`,
    );
  }
  const fromTable = first.primary_table;
  // Validate the FROM table exists in the allow-list.
  resolveTable(setup, fromTable);

  const joinClauses: string[] = [];

  for (let i = 1; i < defs.length; i++) {
    const def = defs[i];
    const { primary_table, joined_table, source, target, join_type } = def;

    if (!joined_table || joined_table.trim() === '') {
      throw new Error(
        `buildBaseCte: db_defination entry with fetch_order ${def.fetch_order} ` +
          `is missing joined_table`,
      );
    }
    if (!source || !target) {
      throw new Error(
        `buildBaseCte: join from "${primary_table}" to "${joined_table}" ` +
          `is missing source/target keys`,
      );
    }

    const joinKw = join_type?.toLowerCase() === 'left' ? 'LEFT JOIN' : 'INNER JOIN';
    const { alias: joinedAlias, physical: joinedPhysical } = resolveTable(setup, joined_table);

    // ON <primary alias>.<source> = <joined alias>.<target>
    const leftCol = qualifiedColumn(setup, primary_table, source);
    const rightCol = qualifiedColumn(setup, joined_table, target);

    joinClauses.push(
      `${joinKw} ${quoteTableWithAlias(joinedPhysical, joinedAlias)} ON ${leftCol} = ${rightCol}`,
    );
  }

  return { fromTable, joinClauses };
}

// Local helper — `"<physical>" AS "<alias>"` using the SA-1 quoting primitive.
// Both identifiers are validated upstream via resolveTable; quoteIdent applies
// the canonical SQLite double-quote escaping.
function quoteTableWithAlias(physical: string, alias: string): string {
  return `${quoteIdent(physical)} AS ${quoteIdent(alias)}`;
}

// ---------------------------------------------------------------------------
// Column collection
// ---------------------------------------------------------------------------

function collectColumns(config: ReportConfig): ColRef[] {
  const seen = new Set<string>();
  const out: ColRef[] = [];

  const add = (table: string, field: string): void => {
    if (!table || !field || table.trim() === '' || field.trim() === '') return;
    // Calculated columns are emitted separately (compiled expression), not as
    // a raw physical column.
    if (table === 'calculated') return;
    const key = colKey(table, field);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ table, field });
  };

  // report_columns
  (config.report_columns ?? []).forEach((c: ReportColumn) => add(c.table, c.field));

  // group_by_fields: main field + display[] + group_total[]
  Object.values(config.group_by_fields ?? {}).forEach((g: GroupByField) => {
    add(g.table, g.field);
    (g.display ?? []).forEach((d) => add(d.table, d.field));
    (g.group_total ?? []).forEach((t) => add(t.table, t.field));
  });

  // calc-field dependencies (Table.Field form)
  (config.custom_calculated_fields ?? []).forEach((calc) => {
    (calc.dependencies ?? []).forEach((dep) => {
      const parts = dep.split('.');
      if (parts.length === 2) add(parts[0], parts[1]);
    });
  });

  // summary_fields & body_sort_order are stored as bare field names. Resolve
  // each (against the columns already known above) so the owning physical
  // column is guaranteed to be SELECTed into `base`; otherwise the outer
  // builder query would reference a column that does not exist in `base`.
  // Calculated summary/sort fields are already emitted via their expression.
  const addBare = (bare: string): void => {
    if (!bare || bare.trim() === '') return;
    const resolved = resolveBareFieldFromRefs(out, config, bare);
    if (resolved && !('calculated' in resolved)) add(resolved.table, resolved.field);
  };
  (config.summary_fields ?? []).forEach(addBare);
  (config.body_sort_order ?? []).forEach((s) => addBare(s.field));

  return out;
}

/**
 * Internal: like resolveBareField but also consults the in-progress column
 * list (so a field that only appears via a calc dependency is still found).
 */
function resolveBareFieldFromRefs(
  knownCols: ColRef[],
  config: ReportConfig,
  bareField: string,
): { table: string; field: string } | { calculated: string } | null {
  const viaConfig = resolveBareField(config, bareField);
  if (viaConfig) return viaConfig;
  const hit = knownCols.find((c) => c.field === bareField);
  return hit ? { table: hit.table, field: hit.field } : null;
}

/**
 * Resolve a bare field name (as used in summary_fields / body_sort_order) to
 * its (table, field) pair by searching the config's known column references.
 *
 * FileMaker config stores these as plain field names; we map them back to the
 * first table that declares the field in report_columns / group_by_fields /
 * calc dependencies. Returns null when not found (caller decides how to react)
 * unless the field is a calculated field name.
 */
export function resolveBareField(
  config: ReportConfig,
  bareField: string,
): { table: string; field: string } | { calculated: string } | null {
  // Calculated field?
  const calc = (config.custom_calculated_fields ?? []).find(
    (c) => c.field_name === bareField,
  );
  if (calc) return { calculated: calc.field_name };

  // report_columns
  for (const c of config.report_columns ?? []) {
    if (c.field === bareField) return { table: c.table, field: c.field };
  }

  // group_by_fields (field / display / group_total)
  for (const g of Object.values(config.group_by_fields ?? {})) {
    if (g.field === bareField) return { table: g.table, field: g.field };
    for (const d of g.display ?? []) {
      if (d.field === bareField) return { table: d.table, field: d.field };
    }
    for (const t of g.group_total ?? []) {
      if (t.field === bareField) return { table: t.table, field: t.field };
    }
  }

  // calc dependencies (Table.Field)
  for (const cf of config.custom_calculated_fields ?? []) {
    for (const dep of cf.dependencies ?? []) {
      const parts = dep.split('.');
      if (parts.length === 2 && parts[1] === bareField) {
        return { table: parts[0], field: parts[1] };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// WHERE clause — FileMaker operator semantics → parameterized SQL
//
// Mirrors convertOperator() in src/lib/utils/utility.ts:
//   A...B   → col BETWEEN ? AND ?  (date fields: converts to Excel serial integers)
//   !=v     → col <> ?
//   >=v     → col >= ?
//   >v      → col > ?
//   <=v     → col <= ?
//   <v      → col < ?
//   ==v     → col = ?            (exact match; normalized "==" → "=")
//   =v      → col = ?
//   *       → col IS NOT NULL AND col <> ''      (not-empty)
//   "" (empty) → col IS NULL OR col = ''         (empty)
//   <other> → col LIKE ?         (contains; binds %v% — the FM `contains`)
// ---------------------------------------------------------------------------

interface Predicate {
  sql: string;
  params: unknown[];
}

/**
 * Normalise a filter date string (MM/DD/YYYY or YYYY-MM-DD) to ISO YYYY-MM-DD.
 * Returns null when the format is unrecognised.
 */
function toIsoDate(dateStr: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Accept both zero-padded (MM/DD/YYYY) and non-padded (M/D/YYYY)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [m, d, y] = dateStr.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

/**
 * Build a SQL expression that normalises a date column to ISO YYYY-MM-DD
 * regardless of how the value is physically stored:
 *
 *   ISO string  ("2025-01-02")  → used as-is (matches GLOB pattern)
 *   Excel serial ("45294")      → converted via SQLite date() from the
 *                                  Excel epoch (1899-12-30)
 *
 * This lets a single query handle both storage formats transparently, so
 * switching the ETL pipeline from Excel serials to ISO dates requires no
 * engine changes.
 */
function normalizeDateCol(col: string): string {
  return (
    `CASE WHEN ${col} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'` +
    ` THEN ${col}` +
    ` ELSE date('1899-12-30', '+' || CAST(${col} AS INTEGER) || ' days')` +
    ` END`
  );
}

function translateFilter(col: string, rawValue: unknown, fieldType?: string): Predicate {
  const value = rawValue == null ? '' : String(rawValue);

  // Date / numeric range: A...B
  if (value.includes('...')) {
    const [a, b] = value.split('...').map((v) => v.trim());
    // For date fields, normalise the stored value to ISO at query time so the
    // comparison works whether the DB stores Excel serials ("45293") or ISO
    // strings ("2025-01-02"). Filter params are always normalised to ISO too.
    if (fieldType === 'date') {
      const iso1 = toIsoDate(a);
      const iso2 = toIsoDate(b);
      if (iso1 !== null && iso2 !== null) {
        return { sql: `${normalizeDateCol(col)} BETWEEN ? AND ?`, params: [iso1, iso2] };
      }
    }
    return { sql: `${col} BETWEEN ? AND ?`, params: [a, b] };
  }

  // Not-equal
  if (value.startsWith('!=')) {
    return { sql: `${col} <> ?`, params: [value.slice(2).trim()] };
  }

  // Comparisons (order matters: check >= before >, <= before <)
  if (value.startsWith('>=')) {
    return { sql: `${col} >= ?`, params: [value.slice(2).trim()] };
  }
  if (value.startsWith('<=')) {
    return { sql: `${col} <= ?`, params: [value.slice(2).trim()] };
  }
  if (value.startsWith('>')) {
    return { sql: `${col} > ?`, params: [value.slice(1).trim()] };
  }
  if (value.startsWith('<')) {
    return { sql: `${col} < ?`, params: [value.slice(1).trim()] };
  }

  // Exact match: == (normalized) or =
  if (value.startsWith('==')) {
    return { sql: `${col} = ?`, params: [value.slice(2).trim()] };
  }
  if (value.startsWith('=')) {
    return { sql: `${col} = ?`, params: [value.slice(1).trim()] };
  }

  // Not-empty
  if (value === '*') {
    return { sql: `(${col} IS NOT NULL AND ${col} <> '')`, params: [] };
  }

  // Empty
  if (value === '') {
    return { sql: `(${col} IS NULL OR ${col} = '')`, params: [] };
  }

  // Default → contains (LIKE %value%)
  return { sql: `${col} LIKE ?`, params: [`%${value}%`] };
}

function buildWhere(
  config: ReportConfig,
  setup: SqlSetup,
): Predicate {
  const clauses: string[] = [];
  const params: unknown[] = [];

  const applyGroup = (group: Record<string, Record<string, string>> | undefined): void => {
    if (!group) return;
    // Deterministic ordering: tables then fields, by declaration order in the
    // object (JS preserves string-key insertion order).
    for (const table of Object.keys(group)) {
      const fields = group[table];
      for (const field of Object.keys(fields)) {
        const col = qualifiedColumn(setup, table, field);
        // Pass the field's declared type so translateFilter can choose the right
        // comparison strategy (e.g. Excel serial conversion for 'date' fields).
        let fieldType: string | undefined;
        try {
          fieldType = resolveField(setup, table, field).def.type;
        } catch {
          // Unknown field — resolveField will throw again during SELECT building;
          // leave fieldType undefined and let translateFilter fall through to default.
        }
        const pred = translateFilter(col, fields[field], fieldType);
        clauses.push(pred.sql);
        params.push(...pred.params);
      }
    }
  };

  // filters first, then date_range_fields (matches FM buildFilters merge order)
  applyGroup(config.filters);
  applyGroup(config.date_range_fields);

  return {
    sql: clauses.length > 0 ? clauses.join(' AND ') : '',
    params,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildBaseCte(config: ReportConfig, setup: SqlSetup): BaseCteResult {
  const { fromTable, joinClauses } = buildJoinPlan(config, setup);

  // -- SELECT columns ------------------------------------------------------
  const selectParts: string[] = [];
  const selectedColumns: string[] = [];

  const cols = collectColumns(config);
  for (const { table, field } of cols) {
    // Validate field exists (throws on unknown — keeps SQL safe).
    resolveField(setup, table, field);
    const qualified = qualifiedColumn(setup, table, field);
    const alias = columnAlias(table, field);
    selectParts.push(`${qualified} AS ${alias}`);
    selectedColumns.push(alias);
  }

  // Calculated fields → compiled expression, aliased calculated.<name>.
  for (const calc of config.custom_calculated_fields ?? []) {
    const { expr } = compileFormula(setup, calc, (t, f) => qualifiedColumn(setup, t, f));
    const alias = calculatedAlias(calc.field_name);
    selectParts.push(`${expr} AS ${alias}`);
    selectedColumns.push(alias);
  }

  if (selectParts.length === 0) {
    // No columns referenced anywhere — degenerate but valid; select a constant
    // so the CTE is syntactically valid and COUNT(*) still works.
    selectParts.push('1 AS "__placeholder"');
  }

  // -- FROM / JOIN ---------------------------------------------------------
  const { physical: fromPhysical, alias: fromAlias } = resolveTable(setup, fromTable);
  const fromClause = quoteTableWithAlias(fromPhysical, fromAlias);

  // -- WHERE ---------------------------------------------------------------
  const where = buildWhere(config, setup);

  // -- Assemble ------------------------------------------------------------
  let inner = `SELECT ${selectParts.join(', ')} FROM ${fromClause}`;
  if (joinClauses.length > 0) {
    inner += ` ${joinClauses.join(' ')}`;
  }
  if (where.sql) {
    inner += ` WHERE ${where.sql}`;
  }

  const cteSql = `WITH base AS ( ${inner} )`;

  return { cteSql, params: where.params, selectedColumns };
}
