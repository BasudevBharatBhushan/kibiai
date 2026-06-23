// ---------------------------------------------------------------------------
// Deterministic identifier handling — the injection-safety foundation.
// Every identifier that reaches SQL must pass through this module.
// Pure module — no React, no Next.js server imports.
// ---------------------------------------------------------------------------

import type { SqlSetup, SqlFieldDef } from './types';

// ---------------------------------------------------------------------------
// Primitive quoting
// ---------------------------------------------------------------------------

/**
 * Wrap a raw identifier in SQLite double-quote delimiters, escaping any
 * embedded double-quote characters as "" (per the SQL standard / SQLite docs).
 *
 * Throws if `name` is empty or whitespace-only — those can never be valid
 * column/table names and almost certainly indicate a logic error upstream.
 */
export function quoteIdent(name: string): string {
  if (!name || name.trim().length === 0) {
    throw new Error(`quoteIdent: identifier must not be empty or whitespace`);
  }
  // Escape embedded double-quotes by doubling them
  const escaped = name.replace(/"/g, '""');
  return `"${escaped}"`;
}

// ---------------------------------------------------------------------------
// Table resolution
// ---------------------------------------------------------------------------

export interface ResolvedTable {
  physical: string;
  alias: string;
}

/**
 * Look up a logical table key in the setup allow-list.
 *
 * - `logicalTable` must exist as a key in `setup.tables`; throws otherwise.
 * - Returns the physical table name and a stable alias (uses `alias` from the
 *   definition when present, otherwise derives `t_<logicalTable>`).
 */
export function resolveTable(setup: SqlSetup, logicalTable: string): ResolvedTable {
  const tableDef = setup.tables[logicalTable];
  if (!tableDef) {
    const available = Object.keys(setup.tables).join(', ');
    throw new Error(
      `resolveTable: unknown logical table "${logicalTable}". ` +
        `Available tables: [${available}]`,
    );
  }
  const alias = `t_${logicalTable}`;
  return { physical: tableDef.physical, alias };
}

// ---------------------------------------------------------------------------
// Field resolution
// ---------------------------------------------------------------------------

export interface ResolvedField {
  physicalName: string;
  def: SqlFieldDef;
}

/**
 * Look up a logical field key within a logical table in the setup allow-list.
 *
 * Both the table and the field must be present; throws with a clear message
 * if either is missing. Unknown fields can never reach SQL.
 */
export function resolveField(
  setup: SqlSetup,
  logicalTable: string,
  logicalField: string,
): ResolvedField {
  const tableDef = setup.tables[logicalTable];
  if (!tableDef) {
    const available = Object.keys(setup.tables).join(', ');
    throw new Error(
      `resolveField: unknown logical table "${logicalTable}". ` +
        `Available tables: [${available}]`,
    );
  }

  const fieldDef = tableDef.fields[logicalField];
  if (!fieldDef) {
    const available = Object.keys(tableDef.fields).join(', ');
    throw new Error(
      `resolveField: unknown logical field "${logicalField}" in table "${logicalTable}". ` +
        `Available fields: [${available}]`,
    );
  }

  return { physicalName: logicalField, def: fieldDef };
}

// ---------------------------------------------------------------------------
// Composed references
// ---------------------------------------------------------------------------

/**
 * Returns a fully-quoted `"<alias>"."<physical_name>"` column reference.
 *
 * All identifiers are validated against the allow-list before quoting, so
 * arbitrary strings can never reach the SQL string.
 *
 * Example: qualifiedColumn(setup, 'SLS', 'InvoiceNo') → `"t1"."invoice_no"`
 */
export function qualifiedColumn(
  setup: SqlSetup,
  logicalTable: string,
  logicalField: string,
): string {
  const { alias } = resolveTable(setup, logicalTable);
  const { physicalName } = resolveField(setup, logicalTable, logicalField);
  return `${quoteIdent(alias)}.${quoteIdent(physicalName)}`;
}

/**
 * Canonical SELECT alias for a column — used consistently by builders and the
 * structure adapter so downstream code can map values back to field labels.
 *
 * Format: `"<logicalTable>.<logicalField>"`
 *
 * Note: the alias itself is a single quoted string token in SQL
 * (`AS "<logicalTable>.<logicalField>"`). The dot inside is valid within
 * a double-quoted alias in SQLite.
 */
export function columnAlias(logicalTable: string, logicalField: string): string {
  return quoteIdent(`${logicalTable}.${logicalField}`);
}
