import type { AIInsightPlan } from "./types";

/**
 * Insight Response Parser — ST-7
 *
 * Extracts and validates the AIInsightPlan JSON from the raw assistant response text.
 * Equivalent of extractJson() in the chart builder, but typed for AIInsightPlan.
 *
 * Handles:
 *   - JSON wrapped in ```json ... ``` fenced blocks
 *   - Raw JSON objects in the response text
 *   - Returns null if parsing fails or shape is invalid
 */
export function parseInsightResponse(rawText: string): AIInsightPlan | null {
  try {
    let jsonStr = rawText.trim();

    // Try fenced code block first: ```json { ... } ```
    const fenced = jsonStr.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (fenced) {
      jsonStr = fenced[1];
    } else {
      // Fall back to extracting the outermost JSON object
      const plain = jsonStr.match(/(\{[\s\S]*\})/);
      if (plain) jsonStr = plain[1];
    }

    let parsed = JSON.parse(jsonStr);

    // Some wrappers might return {"conversation_id": "...", "response": { ... }}
    if (parsed && typeof parsed === "object" && parsed.response) {
      parsed = parsed.response;
    }

    // Validate required shape: { insights: [...] }
    if (!parsed || !Array.isArray(parsed.insights)) {
      console.warn("[InsightParser] Response missing 'insights' array:", parsed);
      return null;
    }

    // Basic item validation — each insight must have id, category, statement_template, calculations
    const validInsights = parsed.insights.filter((item: unknown) => {
      if (!item || typeof item !== "object") return false;
      const i = item as Record<string, unknown>;
      return (
        typeof i.id === "string" &&
        typeof i.category === "string" &&
        typeof i.statement_template === "string" &&
        i.calculations !== null &&
        typeof i.calculations === "object"
      );
    });

    if (!validInsights.length) {
      console.warn("[InsightParser] No valid insights found in response.");
      return null;
    }

    return { 
      response_to_user: typeof parsed.response_to_user === "string" ? parsed.response_to_user : undefined,
      insights: validInsights 
    } as AIInsightPlan;
  } catch (err) {
    console.warn("[InsightParser] Failed to parse AI response:", err);
    return null;
  }
}
