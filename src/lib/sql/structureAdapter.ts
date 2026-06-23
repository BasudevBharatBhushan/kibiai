// ---------------------------------------------------------------------------
// structureAdapter.ts
//
// Pure functions that transform SQL aggregation rows + ReportConfig + SqlSetup
// into two parallel output shapes:
//
//   1. FM-shaped array  — identical structure to generateReportStructure() in
//      /api/generate-report/route.ts, consumable by ClassicReportView without
//      any changes to the viewer.  The Body.BodyField is always [] for collapsed
//      mode (all row data lives in the nested Grouped tree).
//
//   2. NestedReport object — the primary SQL collapsed payload with a typed
//      nested group tree. Ticket-2/3 viewers and the drill-down engine import
//      NestedGroupNode / NestedReport from here.
//
// Design decision: sqlReportEngine.ts returns BOTH shapes in SqlReportResult so
// that (a) the existing ClassicReportView can render the collapsed header +
// subsummary scaffolding via report_structure_json, and (b) new viewers added in
// T2/T3 consume the richer NestedReport directly without re-parsing the FM array.
//
// No DB calls — pure data transformation.
// ---------------------------------------------------------------------------

import type { ReportConfig, GroupByField } from '../reportConfigTypes';
import type { SqlSetup } from './types';

// ---------------------------------------------------------------------------
// Label / prefix / suffix helpers
// ---------------------------------------------------------------------------

/**
 * Flat lookup: `"Table.Field"` alias (the key builders use as SQL alias) →
 * the human-readable label from setup.tables[table].fields[field].label.
 * Falls back to the field logical name when no label is defined.
 *
 * Calculated fields use the alias key `"calculated.fieldName"` — those are
 * resolved via config.custom_calculated_fields in the caller.
 */
export function buildAliasLabelMap(setup: SqlSetup): Map<string, string> {
  const map = new Map<string, string>();
  for (const [logicalTable, tableDef] of Object.entries(setup.tables)) {
    for (const [logicalField, fieldDef] of Object.entries(tableDef.fields)) {
      const aliasKey = `${logicalTable}.${logicalField}`;
      map.set(aliasKey, fieldDef.label || logicalField);
    }
  }
  return map;
}

/** Prefix map keyed by label (same lookup order as FM version). */
export function buildLabelPrefixMap(setup: SqlSetup): Map<string, string> {
  const map = new Map<string, string>();
  for (const tableDef of Object.values(setup.tables)) {
    for (const fieldDef of Object.values(tableDef.fields)) {
      if (fieldDef.prefix) {
        map.set(fieldDef.label || '', fieldDef.prefix);
      }
    }
  }
  return map;
}

/** Suffix map keyed by label. */
export function buildLabelSuffixMap(setup: SqlSetup): Map<string, string> {
  const map = new Map<string, string>();
  for (const tableDef of Object.values(setup.tables)) {
    for (const fieldDef of Object.values(tableDef.fields)) {
      if (fieldDef.suffix) {
        map.set(fieldDef.label || '', fieldDef.suffix);
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Internal label resolver (mirrors FM getFieldLabel)
// ---------------------------------------------------------------------------

function resolveLabel(
  config: ReportConfig,
  aliasLabelMap: Map<string, string>,
  table: string,
  field: string,
): string {
  if (table === 'calculated') {
    const calc = (config.custom_calculated_fields ?? []).find(
      (cf) => cf.field_name === field,
    );
    return calc?.label || field;
  }
  const key = `${table}.${field}`;
  return aliasLabelMap.get(key) ?? field;
}

// ---------------------------------------------------------------------------
// FM-shaped structure types
// ---------------------------------------------------------------------------

interface TitleHeaderBlock {
  TitleHeader: { MainHeading: string; SubHeading: string };
}

interface SubsummaryBlock {
  Subsummary: {
    Sorting: string[];
    SubsummaryFields: string[];
    SubsummaryTotal: string[];
    SubsummaryDisplay: string[];
    SortOrder: 'asc' | 'desc';
  };
}

interface BodyBlock {
  Body: {
    BodyField: Record<string, unknown>[];
    BodyFieldOrder: string[];
    BodySortOrder: Array<{ Column: string; Order: string }>;
    FieldPrefix: Record<string, string>;
    FieldSuffix: Record<string, string>;
    Sorting: string[];
  };
}

interface TrailingGrandSummaryBlock {
  TrailingGrandSummary: { TrailingGrandSummary: string[] };
}

export type FmStructureBlock =
  | TitleHeaderBlock
  | SubsummaryBlock
  | BodyBlock
  | TrailingGrandSummaryBlock;

// ---------------------------------------------------------------------------
// Nested tree types (exported for Ticket 2/3 consumers)
// ---------------------------------------------------------------------------

/** One node in the per-level group tree. */
export interface NestedGroupNode {
  /** Logical alias key of the group field: "Table.Field". */
  field: string;
  /** Human-readable label of the group field. */
  label: string;
  /** The raw group value for this node. */
  value: unknown;
  /** Row count for this group. */
  count: number;
  /** Aggregate totals: label → numeric value. */
  totals: Record<string, number>;
  /** Display-field values: label → raw value. */
  display: Record<string, unknown>;
  /** Child group nodes (populated for multi-level reports). */
  children?: NestedGroupNode[];
  /**
   * Labels of the group_total fields for this group level.
   * Set by the collapsed adapter so ClassicReportView can render the correct
   * footer columns without a local NestedGroupNodeEx workaround.
   */
  totalFields?: string[];
  /**
   * Detailed body rows for this node (populated for expand-all / leaf nodes
   * in Ticket 3). Empty / absent in collapsed mode.
   */
  bodyRows?: Record<string, unknown>[];
}

/** The full collapsed (no body rows) nested report payload. */
export interface NestedReport {
  mode: 'nested';
  title: string;
  /** Ordered column labels (mirrors BodyFieldOrder). */
  fieldOrder: string[];
  /** Prefix map keyed by column label. */
  fieldPrefix: Record<string, string>;
  /** Suffix map keyed by column label. */
  fieldSuffix: Record<string, string>;
  /** Top-level group nodes (level-0 groups, children at deeper levels). */
  groups: NestedGroupNode[];
  /** Grand-total aggregate: label → value. */
  grandTotals: Record<string, number>;
  /** Ordered list of grand-total column labels. */
  grandTotalFields: string[];
  /** Total row count across all groups. */
  grandTotalCount: number;
}

// ---------------------------------------------------------------------------
// Row → value coercion helpers
// ---------------------------------------------------------------------------

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function getRowValue(row: Record<string, unknown>, aliasKey: string): unknown {
  // The alias key from builders is the quoted form e.g. `"SLS.InvoiceNo"`.
  // Rows returned by the server may have either the quoted form or the bare form.
  // Try bare first (most common — SQLite drivers strip outer quotes), then quoted.
  const bare = aliasKey.replace(/^"|"$/g, ''); // strip outer double-quotes
  if (bare in row) return row[bare];
  if (aliasKey in row) return row[aliasKey];
  return undefined;
}

// ---------------------------------------------------------------------------
// Per-level alias key helpers
// ---------------------------------------------------------------------------

function groupFieldAliasKey(g: GroupByField): string {
  return `${g.table}.${g.field}`;
}

function displayAliasKey(d: { table: string; field: string }): string {
  return `${d.table}.${d.field}`;
}

function totalAliasKey(t: { table: string; field: string }): string {
  return `${t.table}.${t.field}`;
}

// ---------------------------------------------------------------------------
// Nested tree builder
//
// Strategy: for each level L row, its "group key" is the concatenation of ALL
// group field values up through level L (i.e. all parent keys + this level's
// value).  For level 0 there is one node per unique level-0 value.
// For level 1 nodes are placed under the matching level-0 parent, and so on.
//
// `levelRows[L]` already has GROUP BY up through level L so rows for level 1
// are already grouped by (level0_val, level1_val) — we just need to nest them.
// ---------------------------------------------------------------------------

function buildGroupKey(row: Record<string, unknown>, groups: GroupByField[], depth: number): string {
  const parts: string[] = [];
  for (let i = 0; i <= depth; i++) {
    const g = groups[i];
    if (!g) break;
    const v = getRowValue(row, `"${g.table}.${g.field}"`);
    parts.push(String(v ?? ''));
  }
  return parts.join('\x00');
}

/**
 * Turn per-level aggregation row arrays into a nested NestedGroupNode tree.
 *
 * @param config       - ReportConfig (for group_by_fields / calc field labels).
 * @param setup        - SqlSetup (for field labels).
 * @param levelRows    - levelRows[L] is the full result set for level L aggregation query.
 */
export function buildNestedGroupTree(
  config: ReportConfig,
  setup: SqlSetup,
  levelRows: Record<string, unknown>[][],
): NestedGroupNode[] {
  const aliasLabelMap = buildAliasLabelMap(setup);
  const groups = Object.values(config.group_by_fields ?? {});

  if (groups.length === 0 || levelRows.length === 0) return [];

  // Build level-0 nodes first, then attach deeper levels.
  // nodeMap: parentKey (for level 0: '') → Map<groupKey → NestedGroupNode>
  // We use a flat lookup to avoid O(n²) tree traversal.
  const nodeByKey = new Map<string, NestedGroupNode>();

  for (let level = 0; level < groups.length; level++) {
    const g = groups[level];
    if (!g) continue;
    const rows = levelRows[level] ?? [];

    const fieldAlias = groupFieldAliasKey(g);
    const fieldLabel = resolveLabel(config, aliasLabelMap, g.table, g.field);

    for (const row of rows) {
      const currentKey = buildGroupKey(row, groups, level);
      const parentKey = level === 0 ? null : buildGroupKey(row, groups, level - 1);

      // Build totals for this node (group_total of the current group level).
      const totals: Record<string, number> = {};
      for (const t of g.group_total ?? []) {
        const tAlias = totalAliasKey(t);
        const tLabel = resolveLabel(config, aliasLabelMap, t.table, t.field);
        totals[tLabel] = toNumber(getRowValue(row, `"${tAlias}"`));
      }

      // Build display values.
      const display: Record<string, unknown> = {};
      for (const d of g.display ?? []) {
        const dAlias = displayAliasKey(d);
        const dLabel = resolveLabel(config, aliasLabelMap, d.table, d.field);
        display[dLabel] = getRowValue(row, `"${dAlias}"`);
      }

      const count = toNumber(getRowValue(row, '"row_count"'));
      const value = getRowValue(row, `"${fieldAlias}"`);

      // Collect totalFields labels for this level so ClassicReportView can
      // render footer columns without needing a local NestedGroupNodeEx alias.
      const levelTotalFields: string[] = (g.group_total ?? []).map((t) =>
        resolveLabel(config, aliasLabelMap, t.table, t.field),
      );

      const node: NestedGroupNode = {
        field: fieldAlias,
        label: fieldLabel,
        value,
        count,
        totals,
        display,
        totalFields: levelTotalFields,
      };

      nodeByKey.set(currentKey, node);

      if (level === 0) {
        // top-level nodes are collected below
      } else if (parentKey !== null) {
        const parentNode = nodeByKey.get(parentKey);
        if (parentNode) {
          if (!parentNode.children) parentNode.children = [];
          parentNode.children.push(node);
        }
      }
    }
  }

  // Collect root (level-0) nodes in row order.
  const rootRows = levelRows[0] ?? [];
  const roots: NestedGroupNode[] = [];
  const g0 = groups[0];
  if (g0) {
    for (const row of rootRows) {
      const key = buildGroupKey(row, groups, 0);
      const node = nodeByKey.get(key);
      if (node) roots.push(node);
    }
  }

  return roots;
}

// ---------------------------------------------------------------------------
// Grand-totals extractor
// ---------------------------------------------------------------------------

/**
 * Map the single grand-summary row into label→number totals.
 * grandRow keys are the quoted alias form `"Table.Field"` (matching builders).
 * We map through summary_fields → resolve each to a label.
 */
export function extractGrandTotals(
  config: ReportConfig,
  setup: SqlSetup,
  grandRow: Record<string, unknown> | null,
): { totals: Record<string, number>; fields: string[]; count: number } {
  const aliasLabelMap = buildAliasLabelMap(setup);
  const totals: Record<string, number> = {};
  const fields: string[] = [];
  let count = 0;

  if (!grandRow) return { totals, fields, count };

  // If there are no summary_fields, the grand query emits `total_rows` COUNT(*).
  if ((config.summary_fields ?? []).length === 0) {
    count = toNumber(getRowValue(grandRow, '"total_rows"'));
    return { totals, fields, count };
  }

  for (const bareField of config.summary_fields ?? []) {
    // Resolve bare field to a (table, field) pair by scanning report_columns and
    // group_by_fields (mirrors FM resolveBareField logic).
    let label: string | null = null;
    let aliasKey: string | null = null;

    // Check report_columns
    for (const col of config.report_columns ?? []) {
      if (col.field === bareField) {
        aliasKey = `${col.table}.${col.field}`;
        label = aliasLabelMap.get(aliasKey) ?? bareField;
        break;
      }
    }

    // Check calculated fields
    if (!label) {
      const calc = (config.custom_calculated_fields ?? []).find(
        (cf) => cf.field_name === bareField,
      );
      if (calc) {
        aliasKey = `calculated.${calc.field_name}`;
        label = calc.label || calc.field_name;
      }
    }

    // Check group_by_fields
    if (!label) {
      for (const g of Object.values(config.group_by_fields ?? {})) {
        if (g.field === bareField) {
          aliasKey = `${g.table}.${g.field}`;
          label = aliasLabelMap.get(aliasKey) ?? bareField;
          break;
        }
        for (const t of g.group_total ?? []) {
          if (t.field === bareField) {
            aliasKey = `${t.table}.${t.field}`;
            label = aliasLabelMap.get(aliasKey) ?? bareField;
            break;
          }
        }
        if (label) break;
      }
    }

    if (!label || !aliasKey) {
      label = bareField;
      aliasKey = bareField;
    }

    const rawValue = grandRow ? getRowValue(grandRow, `"${aliasKey}"`) : undefined;
    totals[label] = toNumber(rawValue);
    fields.push(label);
  }

  return { totals, fields, count };
}

// ---------------------------------------------------------------------------
// FM-shaped collapsed structure builder
// ---------------------------------------------------------------------------

/**
 * Produce the FM-shaped report structure array (identical layout to
 * generateReportStructure() in /api/generate-report/route.ts).
 *
 * For the SQL collapsed view, Body.BodyField is always [] — all row data is
 * delivered via the NestedReport.groups tree.  The structure array gives
 * ClassicReportView the metadata it needs to render headers, column order,
 * prefix/suffix, and the grand-summary bar.
 */
export function buildCollapsedStructure(
  config: ReportConfig,
  setup: SqlSetup,
  _levelRows: Record<string, unknown>[][],
  _grandRow: Record<string, unknown> | null,
): FmStructureBlock[] {
  const aliasLabelMap = buildAliasLabelMap(setup);
  const labelPrefixMap = buildLabelPrefixMap(setup);
  const labelSuffixMap = buildLabelSuffixMap(setup);

  const getFieldLabel = (table: string, field: string): string =>
    resolveLabel(config, aliasLabelMap, table, field);

  // BodyFieldOrder — mirrors FM logic exactly
  const bodyFieldOrder: string[] = [];
  for (const col of config.report_columns ?? []) {
    if (!col.table || !col.field) continue;
    const label = getFieldLabel(col.table, col.field);
    if (!bodyFieldOrder.includes(label)) bodyFieldOrder.push(label);
  }
  for (const calc of config.custom_calculated_fields ?? []) {
    const displayLabel = calc.label || calc.field_name;
    if (!bodyFieldOrder.includes(displayLabel)) bodyFieldOrder.push(displayLabel);
  }

  // Exclude group-by main field labels from body (same as FM)
  const excludeLabelsSet = new Set<string>();
  const groups = Object.values(config.group_by_fields ?? {});
  for (const g of groups) {
    excludeLabelsSet.add(getFieldLabel(g.table, g.field));
  }

  const filteredBodyFields = bodyFieldOrder.filter(
    (label) => !excludeLabelsSet.has(label),
  );

  // BodySortOrder
  const bodySortOrder: Array<{ Column: string; Order: string }> = [];
  for (const sortItem of config.body_sort_order ?? []) {
    let fieldLabel: string | null = null;

    const reportCol = (config.report_columns ?? []).find(
      (col) => col.field === sortItem.field,
    );
    if (reportCol) {
      fieldLabel = getFieldLabel(reportCol.table, reportCol.field);
    }

    if (!fieldLabel) {
      const calc = (config.custom_calculated_fields ?? []).find(
        (cf) => cf.field_name === sortItem.field,
      );
      if (calc) fieldLabel = calc.label || calc.field_name;
    }

    if (!fieldLabel) fieldLabel = sortItem.field;

    if (fieldLabel && filteredBodyFields.includes(fieldLabel)) {
      bodySortOrder.push({
        Column: fieldLabel,
        Order: sortItem.sort_order === 'asc' ? 'Asc' : 'Desc',
      });
    }
  }

  // FieldPrefix / FieldSuffix (body labels)
  const fieldPrefix: Record<string, string> = {};
  const fieldSuffix: Record<string, string> = {};
  for (const label of filteredBodyFields) {
    const pfx = labelPrefixMap.get(label);
    const sfx = labelSuffixMap.get(label);
    if (pfx) fieldPrefix[label] = pfx;
    if (sfx) fieldSuffix[label] = sfx;
  }
  // Calculated field format → prefix/suffix
  for (const calc of config.custom_calculated_fields ?? []) {
    const displayLabel = calc.label || calc.field_name;
    if (filteredBodyFields.includes(displayLabel)) {
      switch (calc.format) {
        case 'currency':
          fieldPrefix[displayLabel] = '$';
          break;
        case 'percentage':
          fieldSuffix[displayLabel] = '%';
          break;
        default:
          break;
      }
    }
  }

  // Body.Sorting: group-by main field labels that also appear in body
  const bodySorting: string[] = [];
  for (const g of groups) {
    const label = getFieldLabel(g.table, g.field);
    if (filteredBodyFields.includes(label)) bodySorting.push(label);
  }

  // TrailingGrandSummary labels
  const trailingGrandSummary: string[] = [];
  for (const summaryField of config.summary_fields ?? []) {
    let fieldLabel: string | null = null;

    for (const tableDef of Object.values(setup.tables)) {
      for (const [logicalField, fieldDef] of Object.entries(tableDef.fields)) {
        if (fieldDef.label === summaryField || logicalField === summaryField) {
          fieldLabel = fieldDef.label || logicalField;
          break;
        }
      }
      if (fieldLabel) break;
    }

    if (!fieldLabel) {
      const reportCol = (config.report_columns ?? []).find(
        (col) => col.field === summaryField,
      );
      if (reportCol) fieldLabel = getFieldLabel(reportCol.table, reportCol.field);
    }

    if (fieldLabel) trailingGrandSummary.push(fieldLabel);
  }

  // Assemble FM array
  const result: FmStructureBlock[] = [];

  // 1. TitleHeader
  result.push({
    TitleHeader: {
      MainHeading: config.report_header || 'Report',
      SubHeading: 'Kibizsystems.com',
    },
  });

  // 2. One Subsummary per group level
  for (const g of groups) {
    const mainFieldLabel = getFieldLabel(g.table, g.field);
    excludeLabelsSet.add(mainFieldLabel);

    const displayLabels: string[] = (g.display ?? []).map((d) =>
      getFieldLabel(d.table, d.field),
    );

    const subsummaryTotal: string[] = (g.group_total ?? []).map((t) =>
      getFieldLabel(t.table, t.field),
    );

    result.push({
      Subsummary: {
        Sorting: [mainFieldLabel],
        SubsummaryFields: [mainFieldLabel],
        SubsummaryTotal: subsummaryTotal,
        SubsummaryDisplay: displayLabels,
        SortOrder: g.sort_order,
      },
    });
  }

  // 3. Body (BodyField is empty for collapsed — row data is in NestedReport)
  result.push({
    Body: {
      BodyField: [],
      BodyFieldOrder: filteredBodyFields,
      BodySortOrder: bodySortOrder,
      FieldPrefix: fieldPrefix,
      FieldSuffix: fieldSuffix,
      Sorting: bodySorting,
    },
  });

  // 4. TrailingGrandSummary
  result.push({
    TrailingGrandSummary: {
      TrailingGrandSummary: trailingGrandSummary,
    },
  });

  return result;
}

// ---------------------------------------------------------------------------
// Drill-down result types and builder
// ---------------------------------------------------------------------------

/**
 * The shape returned by buildDrilldownResult and stored in
 * SqlReportResult.group_rows.  The UI (ClassicReportView DrillModal) renders
 * bodyRows using fieldOrder / fieldPrefix / fieldSuffix exactly as it would
 * for a collapsed Body block, and uses totalFields + totals for the modal
 * footer group-total row.
 */
export interface DrilldownResult {
  /** Each raw detail row with alias keys mapped to human-readable labels. */
  bodyRows: Record<string, unknown>[];
  /** Column labels in config order (mirrors BodyFieldOrder). */
  fieldOrder: string[];
  /** Prefix map keyed by column label. */
  fieldPrefix: Record<string, string>;
  /** Suffix map keyed by column label. */
  fieldSuffix: Record<string, string>;
  /**
   * Labels of the group_total fields for the deepest group level — these are
   * the columns the modal footer sums.
   */
  totalFields: string[];
  /**
   * Summed totals across all bodyRows for each totalField label.
   * Numeric strings are coerced to numbers before summing.
   */
  totals: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Shared alias→label helpers (used by drilldown + expand-all)
// ---------------------------------------------------------------------------

/**
 * Build a full alias→label map that merges the setup field labels with any
 * custom calculated field labels. Covers all keys that buildDetailQuery can
 * emit as row keys.
 */
export function buildFullAliasToLabelMap(
  config: ReportConfig,
  aliasLabelMap: Map<string, string>,
): Map<string, string> {
  const full = new Map<string, string>(aliasLabelMap);
  for (const calc of config.custom_calculated_fields ?? []) {
    const calcKey = `calculated.${calc.field_name}`;
    full.set(calcKey, calc.label || calc.field_name);
  }
  return full;
}

/**
 * Map a single raw SQL detail row (alias keys) to label-keyed form.
 * Alias keys may arrive with or without surrounding double-quotes;
 * unrecognised keys are passed through unchanged.
 */
export function mapAliasRowToLabels(
  row: Record<string, unknown>,
  fullAliasToLabel: Map<string, string>,
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(row)) {
    // Strip surrounding double-quotes that the SQL driver may include.
    const bareKey = rawKey.replace(/^"|"$/g, '');
    const label = fullAliasToLabel.get(bareKey);
    if (label !== undefined) {
      mapped[label] = value;
    } else {
      // Pass through unrecognised keys (e.g. internal fields) unchanged.
      mapped[rawKey] = value;
    }
  }
  return mapped;
}

/**
 * Map raw detail rows (keyed by alias `"Table.Field"` or `"calculated.name"`)
 * to rows keyed by human-readable labels, compute totalFields/totals for the
 * deepest group level, and derive fieldOrder/fieldPrefix/fieldSuffix.
 *
 * Pure — no DB calls.
 */
export function buildDrilldownResult(
  config: ReportConfig,
  setup: SqlSetup,
  rows: Record<string, unknown>[],
): DrilldownResult {
  const aliasLabelMap = buildAliasLabelMap(setup);
  const labelPrefixMap = buildLabelPrefixMap(setup);
  const labelSuffixMap = buildLabelSuffixMap(setup);

  const getFieldLabel = (table: string, field: string): string =>
    resolveLabel(config, aliasLabelMap, table, field);

  // ── fieldOrder (mirrors BodyFieldOrder from buildCollapsedStructure) ────────
  // All report_columns labels followed by calc-field labels; duplicates removed.
  const fieldOrder: string[] = [];
  for (const col of config.report_columns ?? []) {
    if (!col.table || !col.field) continue;
    const label = getFieldLabel(col.table, col.field);
    if (!fieldOrder.includes(label)) fieldOrder.push(label);
  }
  for (const calc of config.custom_calculated_fields ?? []) {
    const displayLabel = calc.label || calc.field_name;
    if (!fieldOrder.includes(displayLabel)) fieldOrder.push(displayLabel);
  }

  // ── fieldPrefix / fieldSuffix (all labels in fieldOrder) ────────────────────
  const fieldPrefix: Record<string, string> = {};
  const fieldSuffix: Record<string, string> = {};
  for (const label of fieldOrder) {
    const pfx = labelPrefixMap.get(label);
    const sfx = labelSuffixMap.get(label);
    if (pfx) fieldPrefix[label] = pfx;
    if (sfx) fieldSuffix[label] = sfx;
  }
  for (const calc of config.custom_calculated_fields ?? []) {
    const displayLabel = calc.label || calc.field_name;
    switch (calc.format) {
      case 'currency':
        fieldPrefix[displayLabel] = '$';
        break;
      case 'percentage':
        fieldSuffix[displayLabel] = '%';
        break;
      default:
        break;
    }
  }

  // ── totalFields — group_total of the DEEPEST group level ────────────────────
  const groups = Object.values(config.group_by_fields ?? {});
  const deepestGroup = groups.length > 0 ? groups[groups.length - 1] : undefined;
  const totalFields: string[] = [];
  if (deepestGroup) {
    for (const t of deepestGroup.group_total ?? []) {
      const label = getFieldLabel(t.table, t.field);
      if (!totalFields.includes(label)) totalFields.push(label);
    }
  }

  // ── Map each raw row alias keys → label keys ─────────────────────────────────
  // Build a unified alias → label map that also covers calculated fields.
  const fullAliasToLabel = buildFullAliasToLabelMap(config, aliasLabelMap);

  const bodyRows: Record<string, unknown>[] = rows.map((row) =>
    mapAliasRowToLabels(row, fullAliasToLabel),
  );

  // ── Compute totals by summing totalField values across all bodyRows ──────────
  const totals: Record<string, number> = {};
  for (const field of totalFields) {
    totals[field] = 0;
  }
  for (const row of bodyRows) {
    for (const field of totalFields) {
      totals[field] = (totals[field] ?? 0) + toNumber(row[field]);
    }
  }

  return { bodyRows, fieldOrder, fieldPrefix, fieldSuffix, totalFields, totals };
}

// ---------------------------------------------------------------------------
// NestedReport builder (primary collapsed payload)
// ---------------------------------------------------------------------------

/**
 * Build the primary collapsed payload.
 *
 * @param config     - ReportConfig
 * @param setup      - SqlSetup
 * @param groups     - Nested group tree (from buildNestedGroupTree)
 * @param grandTotals- Extracted grand totals (from extractGrandTotals)
 */
export function buildNestedReport(
  config: ReportConfig,
  setup: SqlSetup,
  groups: NestedGroupNode[],
  grandTotals: ReturnType<typeof extractGrandTotals>,
): NestedReport {
  const aliasLabelMap = buildAliasLabelMap(setup);
  const labelPrefixMap = buildLabelPrefixMap(setup);
  const labelSuffixMap = buildLabelSuffixMap(setup);

  const getFieldLabel = (table: string, field: string): string =>
    resolveLabel(config, aliasLabelMap, table, field);

  // fieldOrder — all report_columns labels then calc-field labels (no dedup of
  // group keys; NestedReport consumers are expected to know group fields are
  // structural and may choose to exclude them from the column list themselves).
  const fieldOrder: string[] = [];
  for (const col of config.report_columns ?? []) {
    if (!col.table || !col.field) continue;
    const label = getFieldLabel(col.table, col.field);
    if (!fieldOrder.includes(label)) fieldOrder.push(label);
  }
  for (const calc of config.custom_calculated_fields ?? []) {
    const displayLabel = calc.label || calc.field_name;
    if (!fieldOrder.includes(displayLabel)) fieldOrder.push(displayLabel);
  }

  // prefix / suffix (full set across all labels in fieldOrder)
  const fieldPrefix: Record<string, string> = {};
  const fieldSuffix: Record<string, string> = {};
  for (const label of fieldOrder) {
    const pfx = labelPrefixMap.get(label);
    const sfx = labelSuffixMap.get(label);
    if (pfx) fieldPrefix[label] = pfx;
    if (sfx) fieldSuffix[label] = sfx;
  }
  for (const calc of config.custom_calculated_fields ?? []) {
    const displayLabel = calc.label || calc.field_name;
    switch (calc.format) {
      case 'currency':
        fieldPrefix[displayLabel] = '$';
        break;
      case 'percentage':
        fieldSuffix[displayLabel] = '%';
        break;
      default:
        break;
    }
  }

  // grand total count: sum of root-level counts
  const grandTotalCount =
    grandTotals.count > 0
      ? grandTotals.count
      : groups.reduce((acc, g) => acc + g.count, 0);

  return {
    mode: 'nested',
    title: config.report_header || 'Report',
    fieldOrder,
    fieldPrefix,
    fieldSuffix,
    groups,
    grandTotals: grandTotals.totals,
    grandTotalFields: grandTotals.fields,
    grandTotalCount,
  };
}

// ---------------------------------------------------------------------------
// Expand-all / print report builder (Ticket 3 / SA-10)
// ---------------------------------------------------------------------------

/**
 * Compute the group-key path for a single detail row as a tuple of string
 * values for levels 0..N-1 (group fields in order).
 *
 * The detail rows use the same bare alias keys as aggregation rows —
 * `"Table.Field"` (possibly bare, possibly quoted by the driver). We normalise
 * by trying the same `getRowValue` logic used in buildNestedGroupTree.
 */
function detailRowGroupKey(
  row: Record<string, unknown>,
  groups: GroupByField[],
): string[] {
  return groups.map((g) => {
    const v = getRowValue(row, `"${g.table}.${g.field}"`);
    return String(v ?? '');
  });
}

/**
 * Recursively visit all leaf nodes of the nested group tree and fill in
 * `bodyRows` for each leaf from the flat `detailRows` array.
 *
 * Strategy: build a Map keyed by serialised group-key path (level-0 value,
 * level-1 value, …, leaf-level value joined by the same NUL separator used
 * in `buildGroupKey`).  Then scan `detailRows` once: for each row compute its
 * key path, look up the leaf node, and append the label-mapped row.
 *
 * This is O(rows) with O(leaves) extra space — acceptable at ≤30k rows.
 */
function distributeRowsToLeaves(
  roots: NestedGroupNode[],
  groups: GroupByField[],
  detailRows: Record<string, unknown>[],
  fullAliasToLabel: Map<string, string>,
  totalLevels: number,
): void {
  // Build leaf-key → NestedGroupNode map.
  const leafMap = new Map<string, NestedGroupNode>();

  function visitNode(node: NestedGroupNode, depth: number): void {
    if (depth === totalLevels - 1) {
      // This is a leaf node (deepest level).
      // Reconstruct its key: we need the key up to this depth.
      // We store it in a side-channel via the node's `value` + parent chain.
      // Instead, we build the key when inserting into leafMap using the
      // level rows (already done in buildNestedGroupTree); here we use a
      // breadth-first traversal that tracks the key path alongside the node.
      // NOTE: this inner function is NOT called for the initial traversal —
      // see the outer traversal below that passes the path explicitly.
      leafMap.set('__placeholder__', node);
    } else if (node.children) {
      for (const child of node.children) {
        visitNode(child, depth + 1);
      }
    }
  }
  // Discard the placeholder traversal — we rebuild properly below.
  void visitNode; // suppress unused-variable lint

  // Traversal that tracks the running key path so leaves can be keyed
  // by their full group-key tuple.
  function collectLeaves(node: NestedGroupNode, depth: number, pathSoFar: string[]): void {
    const currentPath = [...pathSoFar, String(node.value ?? '')];
    if (depth === totalLevels - 1) {
      // Leaf node.
      node.bodyRows = [];
      leafMap.set(currentPath.join('\x00'), node);
    } else if (node.children) {
      for (const child of node.children) {
        collectLeaves(child, depth + 1, currentPath);
      }
    }
  }

  for (const root of roots) {
    collectLeaves(root, 0, []);
  }

  // Distribute detail rows into the correct leaf.
  for (const row of detailRows) {
    const keyParts = detailRowGroupKey(row, groups);
    const key = keyParts.join('\x00');
    const leaf = leafMap.get(key);
    if (leaf) {
      if (!leaf.bodyRows) leaf.bodyRows = [];
      leaf.bodyRows.push(mapAliasRowToLabels(row, fullAliasToLabel));
    }
  }

  // Ensure every leaf that received no rows has an explicit empty array.
  for (const leaf of leafMap.values()) {
    if (!leaf.bodyRows) leaf.bodyRows = [];
  }
}

/**
 * Build a fully-expanded NestedReport where every leaf group node carries its
 * body rows (label-keyed, in SQL order).  Used for `expand_all` and `print`
 * view modes.
 *
 * @param config     - ReportConfig (group_by_fields / report_columns / etc.)
 * @param setup      - SqlSetup (field labels / prefix / suffix)
 * @param levelRows  - levelRows[L] is the full aggregation result for level L
 *                     (same as collapsed mode — provides headers/totals/counts)
 * @param detailRows - All detail rows for the whole report (from buildDetailQuery
 *                     with no group filter).  Must already be ordered by group
 *                     keys + body_sort_order (SQL does this).
 * @param grandRow   - Single row from buildGrandSummaryQuery (may be null).
 */
export function buildExpandedNestedReport(
  config: ReportConfig,
  setup: SqlSetup,
  levelRows: Record<string, unknown>[][],
  detailRows: Record<string, unknown>[],
  grandRow: Record<string, unknown> | null,
): NestedReport {
  // ── 1. Build the group tree (headers + totals) exactly like collapsed mode ──
  const roots = buildNestedGroupTree(config, setup, levelRows);

  // ── 2. Extract grand totals ─────────────────────────────────────────────────
  const grandTotals = extractGrandTotals(config, setup, grandRow);

  // ── 3. Build the NestedReport envelope (title, fieldOrder, prefix/suffix) ───
  const report = buildNestedReport(config, setup, roots, grandTotals);

  // ── 4. Distribute detail rows into leaf bodyRows ────────────────────────────
  const groups = Object.values(config.group_by_fields ?? {});
  const totalLevels = groups.length;

  if (totalLevels > 0 && detailRows.length > 0) {
    const aliasLabelMap = buildAliasLabelMap(setup);
    const fullAliasToLabel = buildFullAliasToLabelMap(config, aliasLabelMap);
    distributeRowsToLeaves(report.groups, groups, detailRows, fullAliasToLabel, totalLevels);
  } else if (totalLevels > 0) {
    // No detail rows — set bodyRows:[] on every leaf.
    const aliasLabelMap = buildAliasLabelMap(setup);
    const fullAliasToLabel = buildFullAliasToLabelMap(config, aliasLabelMap);
    distributeRowsToLeaves(report.groups, groups, [], fullAliasToLabel, totalLevels);
  }

  return report;
}
