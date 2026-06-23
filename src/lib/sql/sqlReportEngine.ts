// ---------------------------------------------------------------------------
// sqlReportEngine.ts
//
// Async entry-point for the SQL report engine.  Orchestrates query execution
// and delegates shape-building to structureAdapter.
//
// Only the 'collapsed' mode is fully implemented in Ticket 1.
// Other modes have stub placeholders owned by SA-7 (drilldown) and SA-10
// (expand_all / print) — they throw clearly so callers fail fast.
//
// Usage:
//   const result = await runSqlReport({ setup, config, viewMode: 'collapsed' });
//   // result.report_structure_json  → FM-shaped array for ClassicReportView
//   // result.nested                 → NestedReport for new nested viewers (T2/T3)
// ---------------------------------------------------------------------------

import type { ReportConfig } from '../reportConfigTypes';
import type { SqlSetup, ViewMode } from './types';
import { LARGE_ROW_THRESHOLD } from './types';
import { runQuery } from './sqlClient';
import {
  buildGroupAggregationQuery,
  buildGrandSummaryQuery,
  buildCountQuery,
  buildDetailQuery,
} from './builders';
import {
  buildNestedGroupTree,
  extractGrandTotals,
  buildCollapsedStructure,
  buildNestedReport,
  buildDrilldownResult,
  buildExpandedNestedReport,
  type NestedReport,
  type FmStructureBlock,
  type DrilldownResult,
} from './structureAdapter';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface SqlReportResult {
  /** The view mode that was executed. */
  mode: ViewMode;

  /**
   * FM-shaped structure array (same layout as generateReportStructure in
   * /api/generate-report/route.ts).  Present for 'collapsed' mode.
   * ClassicReportView consumes this directly.
   */
  report_structure_json?: FmStructureBlock[];

  /**
   * Typed nested report — the primary collapsed payload for new viewers.
   * Present for 'collapsed' mode.
   */
  nested?: NestedReport;

  /**
   * Total row count (used by drill-down / expand-all to gate the 30k warning).
   * Not populated in Ticket 1 collapsed mode (aggregates are small).
   */
  row_count?: number;

  /**
   * True when the detail row count exceeds the 30k warning threshold.
   * Only set by drill-down / expand-all modes (Ticket 2/3).
   */
  warn_large?: boolean;

  /**
   * Drill-down detail result — present when mode === 'drilldown' and
   * warn_large is false (or the user confirmed a large fetch).
   * Contains label-keyed body rows, fieldOrder, prefix/suffix maps, and
   * group totals for the deepest level.
   */
  group_rows?: DrilldownResult;

  /**
   * Human-readable log entries describing each query executed, row counts
   * returned, and any warnings.  Mirrors the FM engine's processing_logs.
   */
  processing_logs: string[];
}

// Re-export for SA-8/SA-9 (frontend) to import the same threshold value.
export { LARGE_ROW_THRESHOLD };

// ---------------------------------------------------------------------------
// Group-level helpers
// ---------------------------------------------------------------------------

/** Ordered array of GroupByField values (preserves Record insertion order). */
function groupLevels(config: ReportConfig): number {
  return Object.values(config.group_by_fields ?? {}).length;
}

// ---------------------------------------------------------------------------
// Collapsed mode — full implementation (Ticket 1)
// ---------------------------------------------------------------------------

async function runCollapsed(
  setup: SqlSetup,
  config: ReportConfig,
): Promise<SqlReportResult> {
  const logs: string[] = [];
  const numLevels = groupLevels(config);

  if (numLevels === 0) {
    // No group levels — emit an empty structure with a warning.
    logs.push('WARNING: config has no group_by_fields; returning empty collapsed structure');
    const emptyGroups = buildNestedGroupTree(config, setup, []);
    const emptyGrand = extractGrandTotals(config, setup, null);
    const nested = buildNestedReport(config, setup, emptyGroups, emptyGrand);
    const fmArray = buildCollapsedStructure(config, setup, [], null);
    return {
      mode: 'collapsed',
      report_structure_json: fmArray,
      nested,
      processing_logs: logs,
    };
  }

  // Execute one aggregation query per group level.
  const levelRows: Record<string, unknown>[][] = [];

  for (let level = 0; level < numLevels; level++) {
    let query;
    try {
      query = buildGroupAggregationQuery(config, setup, level);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`sqlReportEngine [collapsed, level ${level}]: failed to build aggregation query — ${msg}`);
    }

    logs.push(`[level ${level}] Executing group aggregation query (params: ${query.params.length})`);

    let result;
    try {
      result = await runQuery(setup.connection, query);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`sqlReportEngine [collapsed, level ${level}]: query execution failed — ${msg}`);
    }

    logs.push(`[level ${level}] Received ${result.rowCount} group row(s)`);
    levelRows.push(result.rows);
  }

  // Execute grand-summary query.
  let grandQuery;
  try {
    grandQuery = buildGrandSummaryQuery(config, setup);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`sqlReportEngine [collapsed, grandSummary]: failed to build grand summary query — ${msg}`);
  }

  logs.push(`Executing grand summary query (params: ${grandQuery.params.length})`);

  let grandResult;
  try {
    grandResult = await runQuery(setup.connection, grandQuery);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`sqlReportEngine [collapsed, grandSummary]: query execution failed — ${msg}`);
  }

  const grandRow = grandResult.rows.length > 0 ? grandResult.rows[0] ?? null : null;
  logs.push(`Grand summary row received (${grandResult.rowCount} row(s))`);

  // Build nested group tree.
  const nestedGroups = buildNestedGroupTree(config, setup, levelRows);
  logs.push(`Built nested group tree: ${nestedGroups.length} root group(s)`);

  // Extract grand totals.
  const grandTotals = extractGrandTotals(config, setup, grandRow);

  // Build both output shapes.
  const nested = buildNestedReport(config, setup, nestedGroups, grandTotals);
  const fmArray = buildCollapsedStructure(config, setup, levelRows, grandRow);

  logs.push('Collapsed structure assembled successfully');

  return {
    mode: 'collapsed',
    report_structure_json: fmArray,
    nested,
    processing_logs: logs,
  };
}

// ---------------------------------------------------------------------------
// Drilldown mode — full implementation (Ticket 2 / SA-7)
// ---------------------------------------------------------------------------

/** One entry in the groupPath supplied by the caller. */
interface GroupPathEntry {
  table: string;
  field: string;
  value: unknown;
}

async function runDrilldown(
  setup: SqlSetup,
  config: ReportConfig,
  groupPath: GroupPathEntry[],
  confirmLarge: boolean,
): Promise<SqlReportResult> {
  const logs: string[] = [];

  // Map groupPath entries (table/field/value) straight to the groupFilter shape
  // expected by buildCountQuery / buildDetailQuery — they are identical structs.
  const groupFilter = groupPath.map((entry) => ({
    table: entry.table,
    field: entry.field,
    value: entry.value,
  }));

  logs.push(
    `[drilldown] group filter: ${groupFilter.map((gf) => `${gf.table}.${gf.field}=${String(gf.value)}`).join(', ')}`,
  );

  // ── Step 1: count query ────────────────────────────────────────────────────
  let countQuery;
  try {
    countQuery = buildCountQuery(config, setup, groupFilter);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`sqlReportEngine [drilldown, count]: failed to build count query — ${msg}`);
  }

  logs.push(`[drilldown] Executing count query (params: ${countQuery.params.length})`);

  let countResult;
  try {
    countResult = await runQuery(setup.connection, countQuery);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`sqlReportEngine [drilldown, count]: query execution failed — ${msg}`);
  }

  const countRow = countResult.rows[0] ?? {};
  // The count alias is `total_rows` (quoted form in the row may or may not include quotes).
  const rawCount =
    countRow['total_rows'] ??
    countRow['"total_rows"'] ??
    0;
  const rowCount = typeof rawCount === 'number' ? rawCount : Number(rawCount) || 0;
  logs.push(`[drilldown] Row count: ${rowCount}`);

  // ── Step 2: 30k guard ─────────────────────────────────────────────────────
  if (rowCount > LARGE_ROW_THRESHOLD && !confirmLarge) {
    logs.push(
      `[drilldown] Row count ${rowCount} exceeds threshold ${LARGE_ROW_THRESHOLD}; returning warn_large:true`,
    );
    return {
      mode: 'drilldown',
      row_count: rowCount,
      warn_large: true,
      processing_logs: logs,
    };
  }

  if (rowCount > LARGE_ROW_THRESHOLD) {
    logs.push(
      `[drilldown] Row count ${rowCount} exceeds threshold but confirmLarge=true; proceeding`,
    );
  }

  // ── Step 3: detail query ───────────────────────────────────────────────────
  let detailQuery;
  try {
    detailQuery = buildDetailQuery(config, setup, groupFilter);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`sqlReportEngine [drilldown, detail]: failed to build detail query — ${msg}`);
  }

  logs.push(`[drilldown] Executing detail query (params: ${detailQuery.params.length})`);

  let detailResult;
  try {
    detailResult = await runQuery(setup.connection, detailQuery);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`sqlReportEngine [drilldown, detail]: query execution failed — ${msg}`);
  }

  logs.push(`[drilldown] Received ${detailResult.rowCount} detail row(s)`);

  // ── Step 4: adapt rows → label-keyed DrilldownResult ──────────────────────
  const drilldownResult = buildDrilldownResult(config, setup, detailResult.rows);
  logs.push('[drilldown] Drill-down result assembled successfully');

  return {
    mode: 'drilldown',
    row_count: rowCount,
    warn_large: false,
    group_rows: drilldownResult,
    processing_logs: logs,
  };
}

// ---------------------------------------------------------------------------
// Expand-all / print mode — full implementation (Ticket 3 / SA-10)
// ---------------------------------------------------------------------------

/**
 * Shared implementation for 'expand_all' and 'print'.
 * Both return the fully nested report with bodyRows populated on every leaf.
 * SA-11 renders the print view; SA-10 (this function) assembles the data.
 *
 * Flow:
 *  1. COUNT(*) over the entire report (no group filter) → rowCount.
 *  2. If rowCount > LARGE_ROW_THRESHOLD && !confirmLarge → return warn_large:true.
 *  3. Otherwise: run one aggregation query per group level, run the full detail
 *     query (no filter), run grand-summary, assemble via buildExpandedNestedReport.
 */
async function runExpandAll(
  setup: SqlSetup,
  config: ReportConfig,
  viewMode: 'expand_all' | 'print',
  confirmLarge: boolean,
): Promise<SqlReportResult> {
  const logs: string[] = [];
  const numLevels = groupLevels(config);

  // ── Step 1: global count query (no group filter) ───────────────────────────
  let countQuery;
  try {
    countQuery = buildCountQuery(config, setup);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`sqlReportEngine [${viewMode}, count]: failed to build count query — ${msg}`);
  }

  logs.push(`[${viewMode}] Executing global count query (params: ${countQuery.params.length})`);

  let countResult;
  try {
    countResult = await runQuery(setup.connection, countQuery);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`sqlReportEngine [${viewMode}, count]: query execution failed — ${msg}`);
  }

  const countRow = countResult.rows[0] ?? {};
  const rawCount =
    countRow['total_rows'] ??
    countRow['"total_rows"'] ??
    0;
  const rowCount = typeof rawCount === 'number' ? rawCount : Number(rawCount) || 0;
  logs.push(`[${viewMode}] Row count: ${rowCount}`);

  // ── Step 2: 30k guard ─────────────────────────────────────────────────────
  if (rowCount > LARGE_ROW_THRESHOLD && !confirmLarge) {
    logs.push(
      `[${viewMode}] Row count ${rowCount} exceeds threshold ${LARGE_ROW_THRESHOLD}; returning warn_large:true`,
    );
    return {
      mode: viewMode,
      row_count: rowCount,
      warn_large: true,
      processing_logs: logs,
    };
  }

  if (rowCount > LARGE_ROW_THRESHOLD) {
    logs.push(
      `[${viewMode}] Row count ${rowCount} exceeds threshold but confirmLarge=true; proceeding`,
    );
  }

  // ── Step 3: group aggregation per level (same as collapsed) ───────────────
  const levelRows: Record<string, unknown>[][] = [];

  if (numLevels > 0) {
    for (let level = 0; level < numLevels; level++) {
      let aggQuery;
      try {
        aggQuery = buildGroupAggregationQuery(config, setup, level);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `sqlReportEngine [${viewMode}, level ${level}]: failed to build aggregation query — ${msg}`,
        );
      }

      logs.push(`[${viewMode}][level ${level}] Executing group aggregation query (params: ${aggQuery.params.length})`);

      let aggResult;
      try {
        aggResult = await runQuery(setup.connection, aggQuery);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `sqlReportEngine [${viewMode}, level ${level}]: aggregation query execution failed — ${msg}`,
        );
      }

      logs.push(`[${viewMode}][level ${level}] Received ${aggResult.rowCount} group row(s)`);
      levelRows.push(aggResult.rows);
    }
  }

  // ── Step 4: full detail query (no group filter) ────────────────────────────
  let detailQuery;
  try {
    detailQuery = buildDetailQuery(config, setup);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `sqlReportEngine [${viewMode}, detail]: failed to build detail query — ${msg}`,
    );
  }

  logs.push(`[${viewMode}] Executing full detail query (params: ${detailQuery.params.length})`);

  let detailResult;
  try {
    detailResult = await runQuery(setup.connection, detailQuery);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `sqlReportEngine [${viewMode}, detail]: detail query execution failed — ${msg}`,
    );
  }

  logs.push(`[${viewMode}] Received ${detailResult.rowCount} detail row(s)`);

  // ── Step 5: grand summary ──────────────────────────────────────────────────
  let grandQuery;
  try {
    grandQuery = buildGrandSummaryQuery(config, setup);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `sqlReportEngine [${viewMode}, grandSummary]: failed to build grand summary query — ${msg}`,
    );
  }

  logs.push(`[${viewMode}] Executing grand summary query (params: ${grandQuery.params.length})`);

  let grandResult;
  try {
    grandResult = await runQuery(setup.connection, grandQuery);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `sqlReportEngine [${viewMode}, grandSummary]: grand summary query execution failed — ${msg}`,
    );
  }

  const grandRow = grandResult.rows.length > 0 ? grandResult.rows[0] ?? null : null;
  logs.push(`[${viewMode}] Grand summary row received (${grandResult.rowCount} row(s))`);

  // ── Step 6: assemble expanded nested report ────────────────────────────────
  const nested = buildExpandedNestedReport(
    config,
    setup,
    levelRows,
    detailResult.rows,
    grandRow,
  );
  logs.push(`[${viewMode}] Expanded nested report assembled (${nested.groups.length} root group(s))`);

  // ── Step 7: FM-shaped scaffold (for compatibility with ClassicReportView) ──
  // Reuse buildCollapsedStructure which produces the header/subsummary/body
  // metadata without any actual body rows (BodyField stays []).
  const fmArray = buildCollapsedStructure(config, setup, levelRows, grandRow);

  logs.push(`[${viewMode}] Assembly complete`);

  return {
    mode: viewMode,
    row_count: rowCount,
    warn_large: false,
    nested,
    report_structure_json: fmArray,
    processing_logs: logs,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface RunSqlReportParams {
  setup: SqlSetup;
  config: ReportConfig;
  viewMode: ViewMode;
  /**
   * For drill-down: the group path to filter on.
   * Each entry narrows the query to a specific group value.
   * Owned by SA-7; ignored in Ticket 1.
   */
  groupPath?: Array<{ table: string; field: string; value: unknown }>;
  /**
   * Caller sets this to true after the user has confirmed a 30k row warning.
   * Owned by SA-7 / SA-10; ignored in Ticket 1.
   */
  confirmLarge?: boolean;
}

/**
 * Execute a SQL report and return the result.
 *
 * Ticket 1: only 'collapsed' is fully implemented.
 * Other modes return stub results (no throw) so the API route can gracefully
 * respond while T2/T3 subagents fill in the implementations.
 */
export async function runSqlReport(params: RunSqlReportParams): Promise<SqlReportResult> {
  const { setup, config, viewMode } = params;
  const logs: string[] = [`runSqlReport called with viewMode="${viewMode}"`];

  switch (viewMode) {
    case 'collapsed':
      return runCollapsed(setup, config);

    case 'drilldown':
      return runDrilldown(
        setup,
        config,
        params.groupPath ?? [],
        params.confirmLarge ?? false,
      );

    case 'expand_all':
      return runExpandAll(setup, config, 'expand_all', params.confirmLarge ?? false);

    case 'print':
      return runExpandAll(setup, config, 'print', params.confirmLarge ?? false);

    default: {
      // Exhaustiveness guard — TypeScript will catch unknown ViewMode values at
      // compile time; this branch is a runtime safety net.
      const _never: never = viewMode;
      throw new Error(`runSqlReport: unknown viewMode "${String(_never)}"`);
    }
  }
}
