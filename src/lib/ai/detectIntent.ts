import { ChartIntent } from "./intent";

// Detect the user's intent based on keywords in the prompt
export function detectIntent(userPrompt: string): ChartIntent {
  const prompt = userPrompt.toLowerCase();

  // Check for comparison chart keywords
  if (
    prompt.includes("compare") ||
    prompt.includes("comparison") ||
    prompt.includes("breakdown by") ||
    prompt.includes("status by") ||
    prompt.includes("trend by") ||
    prompt.includes("grouped by")
  ) {
    return "comparison_chart";
  }

  // Check for chart suggestion keywords
  if (
    prompt.includes("suggest") || 
    prompt.includes("recommend")
  ) {
    return "chart_suggestions";
  }
  
  // Check for business insight keywords
  if (
    prompt.includes("business insight") ||
    prompt.includes("business insights") ||
    prompt.includes("analyze the report")
  ) {
    return "business_insight";
  }

  // Check for report analysis keywords
  if (
    prompt.includes("report analysis") ||
    prompt.includes("analyze report")
  ) {
    return "report_analysis";
  }

  // Check for chart generation keywords
  if (
    prompt.includes("chart") ||
    prompt.includes("bar") ||
    prompt.includes("line") ||
    prompt.includes("pie") ||
    prompt.includes("doughnut") ||
    prompt.includes("area")
  ) {
    return "chart_generation";
  }

  return "unknown";
}
