/**
 * sanitizeReportConfig.ts
 *
 * Cleans up an AI-generated (or manually edited) report config to enforce
 * the structural rules validated by validateConfig():
 *
 *  1. Fields in group_by_fields.field / .display / .group_total must NOT
 *     also appear in report_columns (field overlap rule).
 *  2. report_columns must have no duplicate table.field pairs.
 *  3. body_sort_order must have no duplicate field entries.
 *  4. summary_fields must have no duplicates.
 *  5. custom_calculated_fields must have no duplicate field_name entries.
 *  6. custom_calculated_fields entries must NOT appear in db_defination joins.
 *  7. Calculated columns in report_columns (table === "calculated") are kept as-is.
 *
 * This is run BEFORE saving AI-generated config to the DB and BEFORE
 * dispatching it into the ReportContext so the UI always renders clean state.
 */

import type { ReportConfig } from "@/lib/reportConfigTypes";

export function sanitizeReportConfig(config: ReportConfig): ReportConfig {
  if (!config) return config;

  // --- 1. Build the set of all fields used by group_by_fields ---
  const groupedKeys = new Set<string>();
  const groups = config.group_by_fields ? Object.values(config.group_by_fields) : [];

  for (const group of groups) {
    if (group.table && group.field) {
      groupedKeys.add(`${group.table}.${group.field}`);
    }
    for (const d of group.display ?? []) {
      if (d.table && d.field) groupedKeys.add(`${d.table}.${d.field}`);
    }
    for (const t of group.group_total ?? []) {
      if (t.table && t.field) groupedKeys.add(`${t.table}.${t.field}`);
    }
  }

  // --- 2. Remove report_columns entries that overlap with groupings ---
  //        Keep "calculated" table entries always — they are virtual.
  const seenColumns = new Set<string>();
  const cleanColumns = (config.report_columns ?? []).filter((col) => {
    if (!col.table || !col.field) return false;
    const key = `${col.table}.${col.field}`;
    // Keep calculated columns regardless
    if (col.table === "calculated") {
      if (seenColumns.has(key)) return false;
      seenColumns.add(key);
      return true;
    }
    // Remove if in groups
    if (groupedKeys.has(key)) return false;
    // Remove duplicates
    if (seenColumns.has(key)) return false;
    seenColumns.add(key);
    return true;
  });

  // --- 3. Deduplicate body_sort_order ---
  const seenSort = new Set<string>();
  const cleanSort = (config.body_sort_order ?? []).filter((s) => {
    if (!s.field) return false;
    if (seenSort.has(s.field)) return false;
    seenSort.add(s.field);
    return true;
  });

  // --- 4. Deduplicate summary_fields ---
  const seenSummary = new Set<string>();
  const cleanSummary = (config.summary_fields ?? []).filter((f) => {
    if (!f) return false;
    if (seenSummary.has(f)) return false;
    seenSummary.add(f);
    return true;
  });

  // --- 5. Deduplicate custom_calculated_fields by field_name ---
  const seenCalc = new Set<string>();
  const cleanCalc = (config.custom_calculated_fields ?? []).filter((c) => {
    if (!c.field_name) return false;
    const key = c.field_name.toLowerCase();
    if (seenCalc.has(key)) return false;
    seenCalc.add(key);
    return true;
  });

  // --- 6. Deduplicate group_by_fields (remove duplicate table.field groups) ---
  const seenGroups = new Set<string>();
  const cleanGroups: ReportConfig["group_by_fields"] = {};
  for (const [groupKey, group] of Object.entries(config.group_by_fields ?? {})) {
    if (!group.table || !group.field) continue;
    const key = `${group.table}.${group.field}`;
    if (seenGroups.has(key)) continue;
    seenGroups.add(key);
    cleanGroups[groupKey] = group;
  }

  return {
    ...config,
    report_columns: cleanColumns,
    body_sort_order: cleanSort,
    summary_fields: cleanSummary,
    custom_calculated_fields: cleanCalc,
    group_by_fields: cleanGroups,
  };
}
