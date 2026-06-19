import type { InsightContext } from './ChartTypes';

type DateRangeMap = Record<string, Record<string, string>>;
type SetupTables = Record<string, { fields?: Record<string, { label?: string }> }>;

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function resolveLabel(
  setupTables: SetupTables | null,
  tableName: string,
  fieldName: string
): string {
  return setupTables?.[tableName]?.fields?.[fieldName]?.label ?? fieldName;
}

/**
 * Builds an InsightContext from the report's saved `report_config_json` (which
 * already reflects user runtime overrides merged on top of template defaults)
 * and the parent template's `report_template_setup_json` (used to resolve the
 * human-readable field label).
 *
 * Picks the first non-empty `<table>.<field>` entry — the report engine treats
 * the first date_range_field as the primary filter, so the dashboard chip
 * matches what the engine applied.
 */
export function buildInsightContextFromReportConfig(
  reportConfigJson: Record<string, unknown> | null | undefined,
  templateSetupJson: Record<string, unknown> | null | undefined
): InsightContext | undefined {
  const dateRangeFields = (reportConfigJson?.date_range_fields ?? null) as
    | DateRangeMap
    | null;
  if (!dateRangeFields) return undefined;

  const setupTables = (templateSetupJson?.tables ?? null) as SetupTables | null;

  for (const [tableName, tableFields] of Object.entries(dateRangeFields)) {
    for (const [fieldName, rangeStr] of Object.entries(tableFields)) {
      const parts = rangeStr.split('...');
      if (parts.length !== 2) continue;
      const startD = new Date(parts[0]);
      const endD = new Date(parts[1]);
      if (isNaN(startD.getTime()) || isNaN(endD.getTime())) continue;

      return {
        reportStart: toIsoDate(startD),
        reportEnd: toIsoDate(endD),
        reportDateField: resolveLabel(setupTables, tableName, fieldName),
      };
    }
  }

  return undefined;
}

type FilledRange = { from: string; to: string };

/**
 * Variant used by the generate page where date pickers feed the context directly
 * (no `start...end` string yet). Falls back through:
 *   1. filled-in pre-configured ranges
 *   2. ad-hoc ranges
 *   3. template defaults (so users who don't override still see the effective window)
 */
export function buildInsightContextFromState(args: {
  dateRanges: Record<string, Record<string, FilledRange>>;
  adHocDateRanges: Array<{ table: string; field: string; from: string; to: string }>;
  templateConfigJson: Record<string, unknown> | null | undefined;
  templateSetupJson: Record<string, unknown> | null | undefined;
}): InsightContext | undefined {
  const { dateRanges, adHocDateRanges, templateConfigJson, templateSetupJson } = args;
  const setupTables = (templateSetupJson?.tables ?? null) as SetupTables | null;

  for (const [table, fields] of Object.entries(dateRanges)) {
    for (const [field, range] of Object.entries(fields)) {
      if (range?.from && range?.to) {
        return {
          reportStart: range.from,
          reportEnd: range.to,
          reportDateField: resolveLabel(setupTables, table, field),
        };
      }
    }
  }

  for (const r of adHocDateRanges) {
    if (r.table && r.field && r.from && r.to) {
      return {
        reportStart: r.from,
        reportEnd: r.to,
        reportDateField: resolveLabel(setupTables, r.table, r.field),
      };
    }
  }

  return buildInsightContextFromReportConfig(templateConfigJson, templateSetupJson);
}
