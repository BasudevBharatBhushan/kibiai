import { FieldSchema } from '@/lib/insights/fieldSchemaAdapter';

/**
 * Chart copilot context should travel through the predefined prompt so the
 * visible user message stays clean and the conversation retains stable context.
 */
export function buildChartPredefinedPrompt(
  fieldSchemas: FieldSchema[]
): string {
  const fieldList = fieldSchemas.length > 0
    ? fieldSchemas.map(f => {
        const typeHint = f.type === 'date'
          ? `Type: "date" — use group_field_time_bucket or subgroup_field_time_bucket`
          : `Type: "${f.type}"`;
        return `- Field: "${f.name}", Label: "${f.meaning}", ${typeHint}`;
      }).join("\n")
    : "- No fields available yet";

  return `Here are the fields available in the report:\n${fieldList}\n\nPlease use these fields and their exact labels or names when creating chart configurations. You must prefer labels for titles but names or labels for actual grouped/numerical fields.`;
}

export function formatChartPrompt(userText: string): string {
  const trimmed = userText.trim();
  return trimmed.endsWith(".json") ? trimmed : `${trimmed}.json`;
}
