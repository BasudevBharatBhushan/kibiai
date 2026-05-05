import type { FieldSchema } from "@/lib/insights/fieldSchemaAdapter";

/**
 * Insight Predefined Prompt Builder — ST-5
 *
 * Builds the `predefinedPrompt` for the Business Insight Assistant.
 * Sends SCHEMA ONLY — no data, no values, no rows.
 *
 * Output matches the AI's expected INPUT FORMAT exactly:
 *   { "module": "...", "fields": { "fieldName": { "type": "...", "meaning": "..." } } }
 *
 * This is prepended to every user message (same pattern as buildChartPredefinedPrompt).
 */
export function buildInsightPredefinedPrompt(
  moduleName: string,
  fields: FieldSchema[]
): string {
  const contextVariables = ["REPORT_START", "REPORT_END", "REPORT_MIDPOINT"];

  if (!fields.length) {
    return JSON.stringify(
      {
        module: moduleName || "Report",
        context_variables: contextVariables,
        fields: {},
      },
      null,
      2
    );
  }

  const fieldMap: Record<string, { type: string; meaning: string }> = {};
  for (const f of fields) {
    fieldMap[f.name] = { type: f.type, meaning: f.meaning };
  }

  return JSON.stringify(
    { 
      module: moduleName || "Report", 
      context_variables: contextVariables,
      fields: fieldMap 
    },
    null,
    2
  );
}

/**
 * Format function for the insight chatbot.
 * Unlike the chart copilot, no ".json" suffix is needed — the AI returns JSON
 * natively based on the instruction set's OUTPUT FORMAT definition.
 */
export function formatInsightPrompt(userText: string): string {
  return `${userText.trim()}.json`;
}
