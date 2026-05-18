/**
 * reportReloadClassifier.ts
 *
 * Determines whether a config change requires a hard backend reload (data
 * re-fetch) or can be satisfied with a soft client-side re-render.
 *
 * HARD reload triggers (structural — data may change):
 *   • db_defination changes  (joins / tables added or removed)
 *   • report_columns changes (which fields are fetched)
 *   • filters changes
 *   • date_range_fields changes
 *   • custom_calculated_fields formula / dependencies changes
 *
 * SOFT reload only (cosmetic — same underlying data):
 *   • report_header / response_to_user
 *   • body_sort_order
 *   • group_by_fields (grouping / display / totals labels)
 *   • summary_fields order or selection
 *   • calc label / format changes (non-formula)
 */

import { ReportConfig, ReportSetup } from "@/lib/reportConfigTypes";
import { generateReportStructure } from "@/lib/utils/utility";

export type ReloadType = "hard" | "soft";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function stableJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

function hasChanged(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compares `current` config against the `last` snapshot taken at hard-reload
 * time and returns whether we need a "hard" or "soft" reload.
 *
 * @param current   The config as it exists now (after the user made changes)
 * @param last      The config snapshot stored in context.lastGeneratedConfig
 */
export function classifyReload(
  current: ReportConfig,
  last: ReportConfig | null
): ReloadType {
  // No baseline yet — always hard
  if (!last) return "hard";

  // 1. Structural: DB definition (tables / joins)
  if (hasChanged(current.db_defination, last.db_defination)) return "hard";

  // 2. Structural: which columns are fetched
  if (hasChanged(current.report_columns, last.report_columns)) return "hard";

  // 3. Structural: filters
  if (hasChanged(current.filters, last.filters)) return "hard";

  // 4. Structural: date ranges
  if (hasChanged(current.date_range_fields, last.date_range_fields)) return "hard";

  // 5. Structural: calculated field formulas or dependencies
  const currentCalcStructure = (current.custom_calculated_fields || []).map((c) => ({
    field_name: c.field_name,
    formula: c.formula,
    dependencies: c.dependencies,
  }));
  const lastCalcStructure = (last.custom_calculated_fields || []).map((c) => ({
    field_name: c.field_name,
    formula: c.formula,
    dependencies: c.dependencies,
  }));
  if (hasChanged(currentCalcStructure, lastCalcStructure)) return "hard";

  // All remaining changes (labels, sorting, grouping, summaries) → soft
  return "soft";
}

/**
 * Performs a client-side "soft reload" by re-running generateReportStructure
 * against the already-fetched raw stitch result (cached in state.stitchResult).
 *
 * Returns the updated structured array (ready to pass to SET_REPORT_PREVIEW),
 * or null if no stitch data is cached.
 *
 * @param stitchResult   state.stitchResult — cached from the last hard reload SSE event
 * @param config         The updated ReportConfig to apply
 * @param setup          The ReportSetup (schema) — needed for label maps
 */
export function applySoftReload(
  stitchResult: any,
  config: ReportConfig,
  setup: ReportSetup | null
): any[] | null {
  if (!stitchResult || !setup) return null;

  try {
    const updated = generateReportStructure(
      stitchResult,
      config as any,
      setup as any
    );
    // generateReportStructure returns any[] — return it directly.
    // The dispatcher will call SET_REPORT_PREVIEW with this array.
    return updated;
  } catch (err) {
    console.error("[reportReloadClassifier] applySoftReload failed:", err);
    return null;
  }
}
