// ---------------------------------------------------------------------------
// SQL data-source types for KiBiAI
// Used by sqlClient, identifiers, builders, and structureAdapter.
// No React / Next.js imports — pure TypeScript.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Setup-JSON shape (what lives in the template's setup_json column)
// ---------------------------------------------------------------------------

export interface SqlFieldDef {
  type: 'text' | 'number' | 'date';
  label: string;
  prefix?: string;
  suffix?: string;
  valuelist?: string;
}

export interface SqlTableDef {
  physical: string;
  fields: Record<string, SqlFieldDef>;
}

export interface SqlRelationship {
  primary_table: string;
  joined_table: string;
  source: string;
  target: string;
  join_type?: 'left' | 'inner';
}

export interface SqlConnection {
  host: string;
  apiKey: string;
}

export interface SqlSetup {
  data_source_type: 'sql';
  connection_type: 'sqlite';
  connection: SqlConnection;
  tables: Record<string, SqlTableDef>;
  relationships: SqlRelationship[];
}

// ---------------------------------------------------------------------------
// Runtime query types
// ---------------------------------------------------------------------------

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  columns: string[];
}

export interface SqlQuery {
  sql: string;
  params: unknown[];
}

// ---------------------------------------------------------------------------
// View modes for the report UI
// ---------------------------------------------------------------------------

export type ViewMode = 'collapsed' | 'drilldown' | 'expand_all' | 'print';

// ---------------------------------------------------------------------------
// Schema discovery response (future phase — kept permissive but typed)
// ---------------------------------------------------------------------------

export interface SchemaColumn {
  name: string;
  type: string;
  notnull: boolean;
  pk: boolean;
  dflt_value: unknown;
}

export interface SchemaIndex {
  name: string;
  unique: boolean;
  columns: string[];
}

export interface SchemaForeignKey {
  from: string;
  table: string;
  to: string;
}

export interface SchemaTable {
  name: string;
  type: 'table' | 'view' | string;
  columns: SchemaColumn[];
  indexes: SchemaIndex[];
  foreignKeys: SchemaForeignKey[];
}

/**
 * Shape returned by GET /schema.
 * The Bun SQLite server wraps the array under "schema"; kept permissive so
 * a future "tables" key also works.
 */
export interface SchemaResponse {
  schema?: SchemaTable[];
  tables?: SchemaTable[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Drill-down threshold
// ---------------------------------------------------------------------------

/**
 * Maximum number of detail rows to fetch without explicit user confirmation.
 * When a drill-down count query exceeds this value the engine returns a
 * warn_large:true response and does NOT fetch detail rows.
 * SA-8/SA-9 (frontend) should import this constant to render the same number
 * in the confirmation dialog.
 */
export const LARGE_ROW_THRESHOLD = 30_000;

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

/**
 * Returns true when `setup` is a SqlSetup (discriminated by data_source_type).
 * Treats any missing / non-"sql" discriminator as FileMaker (legacy).
 */
export function isSqlSetup(setup: unknown): setup is SqlSetup {
  if (typeof setup !== 'object' || setup === null) return false;
  return (setup as Record<string, unknown>)['data_source_type'] === 'sql';
}
