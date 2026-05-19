import { ChartIntent } from "./intent";
import { INTENT_KEYWORDS } from "@/constants/analytics"; // Import here

export function detectIntent(userPrompt: string): ChartIntent {
  const prompt = userPrompt.toLowerCase();

  // Helper to check if any keyword exists in prompt
  const hasKeyword = (keywords: readonly string[]) => 
    keywords.some(k => prompt.includes(k));

  if (hasKeyword(INTENT_KEYWORDS.comparison)) return "comparison_chart";
  if (hasKeyword(INTENT_KEYWORDS.suggestion)) return "chart_suggestions";
  if (hasKeyword(INTENT_KEYWORDS.insight)) return "business_insight";
  if (hasKeyword(INTENT_KEYWORDS.analysis)) return "report_analysis";
  if (hasKeyword(INTENT_KEYWORDS.generation)) return "chart_generation";

  return "unknown";
}