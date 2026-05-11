/**
 * Build the date-range + filter scope strings shown beneath a report's main
 * heading and on every chart/insight card. Single source of truth so the admin
 * configurator, the saved-report viewer, and the live generate-page preview all
 * render the same scope info.
 */

export interface ReportMetadata {
  dateRange?: {
    field?: string;
    /** YYYY-MM-DD */
    start: string;
    /** YYYY-MM-DD */
    end: string;
  };
  /** Pre-formatted, user-friendly filter sentences */
  filters?: string[];
}

type DateRangeMap = Record<string, Record<string, string>>;
type FilterMap = Record<string, Record<string, unknown>>;
type SetupTables = Record<string, { fields?: Record<string, { label?: string }> }>;

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function resolveLabel(setupTables: SetupTables | null, table: string, field: string): string {
  return setupTables?.[table]?.fields?.[field]?.label ?? field;
}

/**
 * Pretty-print a stored filter value like `==Active`, `>=10`, `*`, `=`
 * into a display sentence: `Status = Active`, `Quantity ≥ 10`, `Status (not empty)`.
 */
function formatFilter(label: string, savedValue: string): string {
  const raw = String(savedValue ?? '').trim();
  if (!raw) return label;

  if (raw === '*') return `${label} (not empty)`;
  if (raw === '=') return `${label} (empty)`;

  const opMap: Array<[string, string]> = [
    ['==', '='],
    ['!=', '≠'],
    ['>=', '≥'],
    ['<=', '≤'],
    ['>', '>'],
    ['<', '<'],
  ];

  for (const [prefix, glyph] of opMap) {
    if (raw.startsWith(prefix)) {
      const value = raw.slice(prefix.length).trim();
      return value ? `${label} ${glyph} ${value}` : `${label} ${glyph}`;
    }
  }

  return `${label}: ${raw}`;
}

export function buildReportMetadata(
  configJson: Record<string, unknown> | null | undefined,
  templateSetupJson: Record<string, unknown> | null | undefined
): ReportMetadata | undefined {
  if (!configJson) return undefined;

  const setupTables = (templateSetupJson?.tables ?? null) as SetupTables | null;

  // ── Date range — first non-empty entry
  const dateRangeFields = (configJson.date_range_fields ?? null) as DateRangeMap | null;
  let dateRange: ReportMetadata['dateRange'] | undefined;

  if (dateRangeFields) {
    outer: for (const [tableName, tableFields] of Object.entries(dateRangeFields)) {
      for (const [fieldName, rangeStr] of Object.entries(tableFields)) {
        const parts = String(rangeStr).split('...');
        if (parts.length !== 2) continue;
        const startD = new Date(parts[0]);
        const endD = new Date(parts[1]);
        if (isNaN(startD.getTime()) || isNaN(endD.getTime())) continue;

        dateRange = {
          field: resolveLabel(setupTables, tableName, fieldName),
          start: toIsoDate(startD),
          end: toIsoDate(endD),
        };
        break outer;
      }
    }
  }

  // ── Filters — every entry, formatted
  const filterMap = (configJson.filters ?? null) as FilterMap | null;
  const filters: string[] = [];

  if (filterMap) {
    for (const [tableName, tableFields] of Object.entries(filterMap)) {
      for (const [fieldName, savedValue] of Object.entries(tableFields)) {
        if (savedValue === undefined || savedValue === null || savedValue === '') continue;
        const label = resolveLabel(setupTables, tableName, fieldName);
        filters.push(formatFilter(label, String(savedValue)));
      }
    }
  }

  if (!dateRange && filters.length === 0) return undefined;

  return {
    dateRange,
    filters: filters.length > 0 ? filters : undefined,
  };
}

/** MM-DD-YYYY display format used in the preview subheader and history rows. */
export function formatDisplayDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${m}-${d}-${y}`;
}
