export const CHART_BOOTSTRAP_ANALYSIS_PROMPT =
  "Provide a report analysis for the given data.";

export function shouldBootstrapStarterCharts(args: {
  schemaCount: number;
  conversationId?: string | null;
}): boolean {
  return args.schemaCount === 0 && !args.conversationId;
}
