import type { FieldSchema } from "@/lib/insights/fieldSchemaAdapter";
import { computeDataStats } from "@/lib/insights/v3/dataStatsComputer";
import type { DataStats } from "@/lib/insights/v3/dataStatsComputer";

/**
 * Insight Predefined Prompt Builder — v3
 *
 * Builds the `predefinedPrompt` injected before every user message in the
 * Business Insight assistant chat. Sends SCHEMA + STATS ONLY — no raw data,
 * no rows, no individual values.
 *
 * Output format matches the AI's INPUT FORMAT exactly:
 *   {
 *     "module": "...",
 *     "fields": { "fieldName": "date|number|text|boolean" },
 *     "report_period": { "start": "...", "end": "...", ... },
 *     "data_stats": { "fieldName": { "avg": n, "max": n, "min": n } },  // optional
 *     "targets": { ... }                                                  // optional
 *   }
 */

export interface InsightPromptOptions {
  /** Pre-computed data stats. If omitted, computed from `dataset` if supplied. */
  dataStats?: DataStats;
  /** Raw dataset — used ONLY to compute `dataStats` if not provided. Never sent to AI. */
  dataset?: Record<string, unknown>[];
  reportPeriod?: {
    start: string;
    end: string;
    previousStart?: string;
    previousEnd?: string;
    midpoint?: string;
  };
  /** Target metric references, e.g. { revenue: "TARGET_REVENUE" } */
  targets?: Record<string, string>;
}

/**
 * Build the predefined prompt for the Business Insight assistant.
 *
 * @returns `{ prompt, dataStats }` — the JSON string to send and the stats used.
 */
export function buildInsightPredefinedPrompt(
  moduleName: string,
  fields: FieldSchema[],
  opts?: InsightPromptOptions
): { prompt: string; dataStats: DataStats } {
  // Build simplified field type map — dimension maps to "text" for v3
  const fieldMap: Record<string, string> = {};
  for (const f of fields) {
    fieldMap[f.name] = f.type === "dimension" ? "text" : f.type;
  }

  // Compute or reuse data stats (numeric fields only)
  let dataStats: DataStats = opts?.dataStats ?? {};
  if (!Object.keys(dataStats).length && opts?.dataset?.length) {
    const numericFields = fields.filter((f) => f.type === "number").map((f) => f.name);
    dataStats = computeDataStats(opts.dataset, numericFields);
  }

  // Report period — use placeholder tokens if actual dates are not known yet
  const reportPeriod = {
    start: opts?.reportPeriod?.start ?? "REPORT_START",
    end: opts?.reportPeriod?.end ?? "REPORT_END",
    previous_start: opts?.reportPeriod?.previousStart ?? "PREV_START",
    previous_end: opts?.reportPeriod?.previousEnd ?? "PREV_END",
    midpoint: opts?.reportPeriod?.midpoint ?? "REPORT_MIDPOINT",
  };

  const payload: Record<string, unknown> = {
    module: moduleName || "Report",
    fields: fieldMap,
    report_period: reportPeriod,
  };

  // Include stats but only expose avg/max/min (count withheld for privacy)
  if (Object.keys(dataStats).length) {
    const statsForPrompt: Record<string, { avg: number; max: number; min: number }> = {};
    for (const [field, stats] of Object.entries(dataStats)) {
      statsForPrompt[field] = { avg: stats.avg, max: stats.max, min: stats.min };
    }
    payload.data_stats = statsForPrompt;
  }

  if (opts?.targets && Object.keys(opts.targets).length) {
    payload.targets = opts.targets;
  }

  return {
    prompt: JSON.stringify(payload, null, 2),
    dataStats,
  };
}

/**
 * Format function for the insight chatbot.
 * The AI returns JSON natively — no suffix manipulation needed.
 */
export function formatInsightPrompt(userText: string): string {
  return userText.trim();
}

/** Re-export for convenience */
export { computeDataStats };
