/**
 * Field Schema Adapter — ST-4
 *
 * Derives FieldSchema[] for the Business Insight predefined prompt by
 * cross-referencing the two report template JSON columns:
 *
 *   report_template_config_json.report_columns[].{ field, table }
 *     → which fields are actually selected in this report
 *
 *   report_template_setup_json.tables[table].fields[field].{ type, label }
 *     → the field's data type and human-readable label (becomes "meaning")
 *
 * IMPORTANT: No data values are ever included. This adapter only handles schema metadata.
 */

export interface FieldSchema {
  name: string;
  type: "number" | "date" | "dimension" | "text" | "boolean";
  meaning: string;
}

/**
 * Maps a raw FileMaker/setup field type string to the insight-compatible type.
 * Anything that is not number, date, or boolean is treated as a "dimension"
 * (a categorical/grouping field) which AI cannot use in numeric formulas.
 */
function mapFieldType(rawType: string): FieldSchema["type"] {
  switch (rawType?.toLowerCase()) {
    case "number":
      return "number";
    case "date":
      return "date";
    case "boolean":
      return "boolean";
    default:
      // text, valuelist, calculated, etc. → dimension
      return "dimension";
  }
}

/**
 * Converts a field name (which might have spaces or special characters)
 * into a valid, camelCase JavaScript identifier for use in formulas.
 */
export function toSafeIdentifier(name: string): string {
  // Handle already safe identifiers (camelCase)
  if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return name;

  let result = name
    .replace(/([A-Z])/g, " $1") // Split PascalCase/camelCase
    .replace(/[^a-zA-Z0-9]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => {
      const cleaned = word.toLowerCase();
      if (i === 0) return cleaned;
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    })
    .join("");

  // Ensure it doesn't start with a digit
  if (/^[0-9]/.test(result)) {
    result = "f" + result;
  }

  return result || "field";
}

/**
 * Builds a FieldSchema[] by cross-referencing:
 *   configJson  = report_template_config_json
 *   setupJson   = report_template_setup_json
 *
 * Only fields present in report_columns are included (the active report fields).
 * Fields not found in setup_json are silently skipped.
 * custom_calculated_fields from config are appended at the end.
 */
export function deriveFieldSchemas(
  configJson: Record<string, unknown> | null | undefined,
  setupJson: Record<string, unknown> | null | undefined
): FieldSchema[] {
  if (!configJson || !setupJson) return [];

  const reportColumns = (
    configJson.report_columns as Array<{ field: string; table: string }> | undefined
  ) ?? [];

  const tables = (
    setupJson.tables as Record<
      string,
      {
        fields: Record<string, { type: string; label?: string }>;
      }
    > | undefined
  ) ?? {};

  const schemas: FieldSchema[] = [];
  const seen = new Set<string>(); // avoid duplicates

  for (const col of reportColumns) {
    if (!col.field || !col.table) continue;
    
    // Use safe name for AI, but keep original if possible for mapping?
    // Actually, AI only sees 'name'.
    const safeName = toSafeIdentifier(col.field);
    if (seen.has(safeName)) continue;

    const tableFields = tables[col.table]?.fields;
    if (!tableFields) continue;

    const fieldMeta = tableFields[col.field];
    if (!fieldMeta) continue;

    seen.add(safeName);
    schemas.push({
      name: safeName,
      type: mapFieldType(fieldMeta.type),
      meaning: fieldMeta.label ?? col.field,
    });
  }

  // Also include custom calculated fields defined in the configurator
  const calcFields = (
    configJson.custom_calculated_fields as Array<{
      field: string;
      type?: string;
      label?: string;
    }> | undefined
  ) ?? [];

  for (const cf of calcFields) {
    if (!cf.field) continue;
    const safeName = toSafeIdentifier(cf.field);
    if (seen.has(safeName)) continue;
    
    seen.add(safeName);
    schemas.push({
      name: safeName,
      type: mapFieldType(cf.type ?? "number"),
      meaning: cf.label ?? cf.field,
    });
  }

  return schemas;
}
