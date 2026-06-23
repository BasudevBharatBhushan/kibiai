export const CHART_BOOTSTRAP_ANALYSIS_PROMPT =
  "Provide a report analysis for the given data.";

export function shouldBootstrapStarterCharts(args: {
  schemaCount: number;
  conversationId?: string | null;
}): boolean {
  // Don't auto-generate if user just deleted all charts intentionally
  if (typeof window !== 'undefined' && sessionStorage.getItem('userDeletedAllCharts') === 'true') {
    return false;
  }
  return args.schemaCount === 0 && !args.conversationId;
}
