/**
 * Formats a user prompt for the Charts Copilot by appending
 * the available field names (from the report body) and optional
 * report insight context — matching the predefined prompt pattern
 * described in the Charts Copilot documentation.
 *
 * Final Prompt = UserPrompt + Predefined Prompt (field names + insight)
 */
export function formatChartPrompt(
  userText: string,
  fieldNames: string[],
  reportInsight?: string
): string {
  const trimmed = userText.trim();

  // Build the predefined field context
  const fieldContext =
    fieldNames.length > 0
      ? `\nFieldName: ${fieldNames.join(", ")}`
      : "";

  // Build the report insight context (only if provided)
  const insightContext =
    reportInsight && reportInsight.trim()
      ? `\n\nAdditionally:\n- Refer to Report insights when generating business interpretation\n- Report Insight: ${reportInsight.trim()}`
      : "";

  const finalPrompt = `${trimmed}${fieldContext}${insightContext}.json`;

  return finalPrompt;
}
