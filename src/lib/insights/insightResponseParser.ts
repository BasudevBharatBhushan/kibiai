import type { AIInsightItem } from "./types";

/**
 * Insight Response Parser — v3 only
 *
 * Expected AI output format:
 *   A JSON array of insight items:
 *   [ { "id": "...", "group": "...", "drill_down": { ... }, "calculations": { ... }, ... }, ... ]
 *
 * Returns AIInsightItem[] on success, null on any failure.
 */

// ─── JSON extraction ──────────────────────────────────────────────────────────

function extractJsonString(rawText: string): string | null {
  const text = rawText.trim();

  // Fenced code blocks — most reliable signal from LLMs
  const fencedArr = text.match(/```json\s*(\[[\s\S]*?\])\s*```/);
  if (fencedArr) return fencedArr[1];
  const fencedObj = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (fencedObj) return fencedObj[1];
  const bareFence = text.match(/```\s*(\[[\s\S]*?\]|\{[\s\S]*?\})\s*```/);
  if (bareFence) return bareFence[1];

  // For plain/embedded text: route by leading character.
  // '[' → top-level array (expected v3 format)
  // '{' → wrapped object (handle gracefully)
  // otherwise: try array first, then object
  const firstChar = text[0];
  if (firstChar === "[") {
    const m = text.match(/(\[[\s\S]*\])/);
    if (m) return m[1];
  } else if (firstChar === "{") {
    const m = text.match(/(\{[\s\S]*\})/);
    if (m) return m[1];
  } else {
    // Embedded — array first (v3 more likely in this context)
    const arrM = text.match(/(\[[\s\S]*\])/);
    if (arrM) return arrM[1];
    const objM = text.match(/(\{[\s\S]*\})/);
    if (objM) return objM[1];
  }

  return null;
}

// ─── Item validation ──────────────────────────────────────────────────────────

function isValidItem(item: unknown): item is AIInsightItem {
  if (!item || typeof item !== "object") return false;
  const i = item as Record<string, unknown>;
  return (
    typeof i.id === "string" &&
    typeof i.group === "string" &&
    typeof i.category === "string" &&
    typeof i.statement_template === "string" &&
    i.calculations !== null &&
    typeof i.calculations === "object" &&
    typeof i.drill_down === "object" &&
    i.drill_down !== null &&
    hasAtLeastOneScopedCalc(i.calculations as Record<string, unknown>)
  );
}

function hasAtLeastOneScopedCalc(calcs: Record<string, unknown>): boolean {
  return Object.values(calcs).some(
    (c) => c && typeof c === "object" && "scope" in (c as object)
  );
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse the AI's raw text response and extract a validated list of insight items.
 * Returns null if the response cannot be parsed or contains no valid items.
 */
export function parseInsightResponse(rawText: string): AIInsightItem[] | null {
  try {
    const jsonStr = extractJsonString(rawText);
    if (!jsonStr) {
      console.warn("[InsightParser] Could not extract JSON from response.");
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.warn("[InsightParser] JSON.parse failed.");
      return null;
    }

    // Unwrap { response: "..." } wrappers that some LLMs emit
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.response === "string") {
        try {
          parsed = JSON.parse(obj.response);
        } catch {
          /* fall through */
        }
      } else if (obj.response && typeof obj.response === "object") {
        parsed = obj.response;
      }
    }

    // Normalise: accept both top-level array and { insights: [...] } wrapper
    let items: unknown[];
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as Record<string, unknown>).insights)
    ) {
      items = (parsed as Record<string, unknown>).insights as unknown[];
    } else if (parsed && typeof parsed === "object" && "id" in parsed && "group" in parsed) {
      items = [parsed];
    } else {
      console.warn("[InsightParser] Unrecognised response shape — expected array or { insights: [...] }.");
      return null;
    }

    const valid = items.filter(isValidItem);
    if (valid.length === 0) {
      console.warn("[InsightParser] No valid insight items found in response.");
      return null;
    }

    return valid;
  } catch (err) {
    console.warn("[InsightParser] Unexpected error:", err);
    return null;
  }
}
