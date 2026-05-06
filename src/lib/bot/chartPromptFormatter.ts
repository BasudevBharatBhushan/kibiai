/**
 * Chart copilot context should travel through the predefined prompt so the
 * visible user message stays clean and the conversation retains stable context.
 */
export function buildChartPredefinedPrompt(
  fieldNames: string[],
  setupJson: Record<string, any> | null,
  configJson: Record<string, any> | null
): string {
  const fieldContext =
    fieldNames.length > 0
      ? `FieldName:\n- ${fieldNames.join("\n- ")}`
      : "FieldName:\n- No fields available yet";

  const setupStr = setupJson ? JSON.stringify(setupJson).replace(/"/g, "'") : "{}";
  const configStr = configJson ? JSON.stringify(configJson).replace(/"/g, "'") : "{}";

  return `${fieldContext}\n\nHere is my DB Schema - ${setupStr}.\n\nHere is my Report Config - ${configStr}.`;
}

export function formatChartPrompt(userText: string): string {
  const trimmed = userText.trim();
  return trimmed.endsWith(".json") ? trimmed : `${trimmed}.json`;
}
