import { FieldSchema } from '@/lib/insights/fieldSchemaAdapter';

/**
 * Chart copilot context should travel through the predefined prompt so the
 * visible user message stays clean and the conversation retains stable context.
 *
 * @param fieldSchemas  Derived from FM schema (may include FM-calculated fields not in data)
 * @param actualFieldNames  Actual column keys present in the report BodyField rows — used to
 *   filter out schema fields that are declared but absent from the real data (e.g. FM calc fields)
 */
export function buildChartPredefinedPrompt(
  fieldSchemas: FieldSchema[],
  actualFieldNames?: string[]
): string {
  // When we have the actual data field names, filter fieldSchemas to only those
  // whose label OR name appears in the real data. FM-calculated fields that are
  // defined in the schema but absent from report output are excluded.
  let effectiveSchemas = fieldSchemas;
  if (actualFieldNames && actualFieldNames.length > 0) {
    const normalise = (s: string) => s.toLowerCase().replace(/\s/g, '');
    const dataKeySet = new Set(actualFieldNames.map(normalise));
    effectiveSchemas = fieldSchemas.filter(
      f => dataKeySet.has(normalise(f.meaning)) || dataKeySet.has(normalise(f.name))
    );

    // Also include any actual data keys not covered by fieldSchemas (extra safety)
    const coveredLabels = new Set(effectiveSchemas.flatMap(f => [normalise(f.meaning), normalise(f.name)]));
    for (const key of actualFieldNames) {
      if (!coveredLabels.has(normalise(key))) {
        // Only add synthetic fields if they are truly missing from schemas
        // Ensure proper FieldSchema shape by including minimal required properties
        effectiveSchemas = [...effectiveSchemas, {
          name: key,
          meaning: key,
          type: 'text',
          originalName: key,
          table: 'data' // Default table for synthetic fields
        } as FieldSchema];
      }
    }
  }

  const fieldList = effectiveSchemas.length > 0
    ? effectiveSchemas.map(f => {
        const typeHint = f.type === 'date'
          ? `Type: "date" — use group_field_time_bucket or subgroup_field_time_bucket`
          : `Type: "${f.type}"`;
        return `- Field: "${f.name}", Label: "${f.meaning}", ${typeHint}`;
      }).join("\n")
    : "- No fields available yet";

  return `Here are the fields available in the report:\n${fieldList}\n\nCRITICAL RULES for field references:\n1. You MUST ONLY use field "name" or "Label" values listed above for numerical_fields, group_field, subgroup_field, and target_field.\n2. Do NOT invent field names that are not in the list above. If the user asks for a metric that doesn't exist (e.g. "amount due"), either:\n   a) Use the closest EXISTING field (e.g. "Balance Due" if that exists), OR\n   b) Define it as a computed_field using arithmetic on EXISTING fields (e.g. "Invoice Total - Amount Paid").\n3. A computed_field MUST include "dependencies" listing the exact existing field names used in the formula.`;
}

export function formatChartPrompt(userText: string): string {
  const trimmed = userText.trim();
  return trimmed.endsWith(".json") ? trimmed : `${trimmed}.json`;
}
