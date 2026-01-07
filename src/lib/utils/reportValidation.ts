import { ReportConfig } from "@/lib/types/reportConfigTypes";

export const validateConfig = (config: ReportConfig): { isValid: boolean; error?: string } => {
  const errors: string[] = [];

  const checkDuplicates = <T>(
    items: T[] | undefined,
    getKey: (item: T) => string | null,
    errorMsg: (key: string) => string
  ) => {
    if (!items) return;
    const seen = new Set<string>();
    for (const item of items) {
      const key = getKey(item);
      if (!key) continue;
      if (seen.has(key)) {
        errors.push(errorMsg(key));
        return; 
      }
      seen.add(key);
    }
  };

  // 1. Check Duplicates
  checkDuplicates(config.report_columns, (c) => (c.table && c.field ? `${c.table}.${c.field}` : null), (k) => `Duplicate Column: ${k}`);
  checkDuplicates(config.body_sort_order, (s) => s.field || null, (k) => `Duplicate Sort Field: ${k}`);
  checkDuplicates(config.custom_calculated_fields, (c) => (c.field_name ? c.field_name.toLowerCase() : null), (k) => `Duplicate Calc Name: "${k}"`);
  
  const groups = config.group_by_fields ? Object.values(config.group_by_fields) : [];
  checkDuplicates(groups, (g) => (g.table && g.field ? `${g.table}.${g.field}` : null), (k) => `Duplicate Grouping: ${k}`);
  
  checkDuplicates(config.summary_fields, (f) => f || null, (k) => `Duplicate Summary Field: ${k}`);

  // 2. Check Overlaps (Groups vs Columns)
  if (config.report_columns && config.group_by_fields) {
    const usedInGroups = new Set<string>();
    Object.values(config.group_by_fields).forEach(group => {
      if (group.table && group.field) usedInGroups.add(`${group.table}.${group.field}`);
      group.display?.forEach(d => d.table && d.field && usedInGroups.add(`${d.table}.${d.field}`));
      group.group_total?.forEach(t => t.table && t.field && usedInGroups.add(`${t.table}.${t.field}`));
    });

    for (const col of config.report_columns) {
      if (col.table && col.field && usedInGroups.has(`${col.table}.${col.field}`)) {
         errors.push(`Field Overlap: "${col.field}" is used in Grouping. Remove from Body.`);
         break; 
      }
    }
  }

  return errors.length > 0 ? { isValid: false, error: errors[0] } : { isValid: true };
};