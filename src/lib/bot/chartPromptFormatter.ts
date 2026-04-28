/**
 * Chart copilot context should travel through the predefined prompt so the
 * visible user message stays clean and the conversation retains stable context.
 */
export function buildChartPredefinedPrompt(
  fieldNames: string[],
  reportInsight?: string
): string {
  const fieldContext =
    fieldNames.length > 0
      ? `FieldName:\n- ${fieldNames.join("\n- ")}`
      : "FieldName:\n- No fields available yet";

  const insightContext =
    reportInsight && reportInsight.trim()
      ? `\n\nAdditionally:\n- Refer to Report insights when generating business interpretation\n- Report Insight: ${reportInsight.trim()}`
      : "";

  return `${fieldContext}${insightContext}`;
}

export function formatChartPrompt(userText: string): string {
  const trimmed = userText.trim();
  return trimmed.endsWith(".json") ? trimmed : `${trimmed}.json`;
}
