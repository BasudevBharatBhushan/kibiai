/**
 * Data Quality Validator — Phase 5d (v3)
 *
 * Checks dataset record count against the AI-defined min_threshold.
 * Insights below threshold are either warned or suppressed.
 */

import type { DataQualityCheck, DataQualityState } from "../types";

/**
 * Evaluate the data quality state for a single insight.
 *
 * - `pass`     → recordCount >= min_threshold
 * - `warn`     → recordCount is between 50% and 100% of threshold
 * - `suppress` → recordCount < 50% of threshold or check is required + failing
 */
export function validateDataQuality(
  check: DataQualityCheck | undefined,
  recordCount: number
): DataQualityState {
  if (!check) return "pass";
  if (!check.required) return "pass";

  const threshold = check.min_threshold ?? 0;
  if (threshold <= 0) return "pass";

  if (recordCount >= threshold) return "pass";
  if (recordCount >= threshold * 0.5) return "warn";
  return "suppress";
}
