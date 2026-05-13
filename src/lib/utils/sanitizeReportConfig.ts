/**
 * Cleans AI-generated or manually edited report configs before they are saved
 * or loaded into the configurator UI.
 */

import type { GroupByField, ReportColumn, ReportConfig } from "@/lib/reportConfigTypes";

type FieldRef = { table: string; field: string };

function inferFieldRef(value: unknown, reportColumns: ReportColumn[]): FieldRef | null {
  if (!value) return null;

  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const rawTable = record.table ?? record.Table;
    const rawField = record.field ?? record.Field ?? record.field_name ?? record.FieldName;
    const table = typeof rawTable === "string" ? rawTable : "";
    const field = typeof rawField === "string" ? rawField : "";
    if (table || field) return { table, field };
  }

  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return null;

    const parts = raw
      .split(/::|\.|:/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      return { table: parts[0], field: parts.slice(1).join(":") };
    }

    const matchingColumn = reportColumns.find((col) => col.field === raw);
    return matchingColumn
      ? { table: matchingColumn.table, field: matchingColumn.field }
      : { table: "", field: raw };
  }

  return null;
}

function normalizeFieldRefArray(value: unknown, reportColumns: ReportColumn[]): FieldRef[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set<string>();
  const refs: FieldRef[] = [];

  for (const item of values) {
    const ref = inferFieldRef(item, reportColumns);
    if (!ref || !ref.field) continue;

    const key = `${ref.table}.${ref.field}`;
    if (seen.has(key)) continue;

    seen.add(key);
    refs.push(ref);
  }

  return refs;
}

function normalizeGroups(config: ReportConfig): ReportConfig["group_by_fields"] {
  const reportColumns = config.report_columns ?? [];
  const rawGroups = config.group_by_fields ?? {};
  const entries = Array.isArray(rawGroups)
    ? rawGroups.map((group, index) => [`Group ${index + 1}`, group] as const)
    : Object.entries(rawGroups);
  const cleanGroups: ReportConfig["group_by_fields"] = {};
  const seenGroups = new Set<string>();

  for (const [fallbackKey, rawGroup] of entries) {
    if (!rawGroup || typeof rawGroup !== "object") continue;

    const groupRecord = rawGroup as Record<string, unknown>;
    const fieldRef =
      inferFieldRef(groupRecord, reportColumns) ??
      inferFieldRef(groupRecord.group_field, reportColumns) ??
      inferFieldRef(
        Array.isArray(groupRecord.SubsummaryFields) ? groupRecord.SubsummaryFields[0] : undefined,
        reportColumns
      );
    const table = fieldRef?.table ?? "";
    const field = fieldRef?.field ?? "";
    if (!field) continue;

    const groupKey =
      typeof groupRecord.label === "string" && groupRecord.label.trim()
        ? groupRecord.label.trim()
        : fallbackKey;
    const dedupeKey = `${table}.${field}`;
    if (seenGroups.has(dedupeKey)) continue;

    seenGroups.add(dedupeKey);
    const sortOrder = typeof groupRecord.sort_order === "string" ? groupRecord.sort_order.toLowerCase() : "";
    const display =
      groupRecord.display ??
      groupRecord.display_fields ??
      groupRecord.SubsummaryDisplay ??
      [];
    const groupTotal =
      groupRecord.group_total ??
      groupRecord.group_totals ??
      groupRecord.group_total_fields ??
      groupRecord.total ??
      groupRecord.totals ??
      groupRecord.SubsummaryTotal ??
      [];

    cleanGroups[groupKey] = {
      table,
      field,
      sort_order: sortOrder === "desc" ? "desc" : "asc",
      display: normalizeFieldRefArray(display, reportColumns),
      group_total: normalizeFieldRefArray(groupTotal, reportColumns),
    } satisfies GroupByField;
  }

  return cleanGroups;
}

function normalizeFilters(filters: ReportConfig["filters"]): ReportConfig["filters"] {
  const cleanFilters: ReportConfig["filters"] = {};

  for (const [table, tableFilters] of Object.entries(filters ?? {})) {
    cleanFilters[table] = {};
    for (const [field, rawValue] of Object.entries(tableFilters ?? {})) {
      const value = String(rawValue ?? "");
      cleanFilters[table][field] = value.startsWith("==") ? `=${value.slice(2)}` : value;
    }
  }

  return cleanFilters;
}

export function sanitizeReportConfig(config: ReportConfig): ReportConfig {
  if (!config) return config;

  const seenColumns = new Set<string>();
  const cleanColumns = (config.report_columns ?? []).filter((col) => {
    if (!col.table || !col.field) return false;
    const key = `${col.table}.${col.field}`;
    if (seenColumns.has(key)) return false;
    seenColumns.add(key);
    return true;
  });

  const seenSort = new Set<string>();
  const cleanSort = (config.body_sort_order ?? []).filter((sort) => {
    if (!sort.field) return false;
    if (seenSort.has(sort.field)) return false;
    seenSort.add(sort.field);
    return true;
  });

  const seenSummary = new Set<string>();
  const cleanSummary = (config.summary_fields ?? []).filter((field) => {
    if (!field) return false;
    if (seenSummary.has(field)) return false;
    seenSummary.add(field);
    return true;
  });

  const seenCalc = new Set<string>();
  const cleanCalc = (config.custom_calculated_fields ?? []).filter((calc) => {
    if (!calc.field_name) return false;
    const key = calc.field_name.toLowerCase();
    if (seenCalc.has(key)) return false;
    seenCalc.add(key);
    return true;
  });

  return {
    ...config,
    report_columns: cleanColumns,
    body_sort_order: cleanSort,
    summary_fields: cleanSummary,
    custom_calculated_fields: cleanCalc,
    group_by_fields: normalizeGroups(config),
    filters: normalizeFilters(config.filters),
  };
}
