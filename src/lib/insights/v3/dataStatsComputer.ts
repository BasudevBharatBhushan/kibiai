/**
 * Data Stats Computer — Phase 2 (v3)
 *
 * Iterates the dataset and computes avg/max/min per numeric field.
 * Output is injected into the v3 prompt input as `data_stats`.
 *
 * PRIVACY NOTE: Only statistical aggregates are computed — no raw values reach the AI.
 */

export interface FieldStats {
  avg: number;
  max: number;
  min: number;
  count: number;
}

export type DataStats = Record<string, FieldStats>;

/**
 * Compute per-field statistics from a normalized dataset.
 * Only processes numeric (non-NaN finite) values.
 *
 * @param dataset  Normalized rows (keys are safe camelCase field names)
 * @param numericFields  Optional allowlist of field names to include; if omitted, all numeric fields
 * @returns DataStats map — only includes fields that had at least 1 numeric value
 */
export function computeDataStats(
  dataset: Record<string, unknown>[],
  numericFields?: string[]
): DataStats {
  if (!dataset.length) return {};

  const sums: Record<string, number> = {};
  const maxs: Record<string, number> = {};
  const mins: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const row of dataset) {
    for (const [key, rawVal] of Object.entries(row)) {
      // If an allowlist is specified, skip fields not in it
      if (numericFields && !numericFields.includes(key)) continue;

      const val = typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal));
      if (!isFinite(val)) continue;

      if (counts[key] === undefined) {
        sums[key] = val;
        maxs[key] = val;
        mins[key] = val;
        counts[key] = 1;
      } else {
        sums[key] += val;
        if (val > maxs[key]) maxs[key] = val;
        if (val < mins[key]) mins[key] = val;
        counts[key]++;
      }
    }
  }

  const result: DataStats = {};
  for (const key of Object.keys(counts)) {
    const n = counts[key];
    result[key] = {
      avg: n > 0 ? sums[key] / n : 0,
      max: maxs[key],
      min: mins[key],
      count: n,
    };
  }

  return result;
}
