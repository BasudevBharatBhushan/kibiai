/**
 * NL Token Resolver — Phase 5c (v3)
 *
 * Resolves natural-language runtime placeholders in statement/summary templates.
 * These are tokens that cannot be pre-computed by the AI since they depend on
 * runtime delta direction and streak counting.
 *
 * Supported tokens:
 *   {trend_direction}    → "increased" | "declined" | "remained stable"
 *   {consecutive_periods} → integer streak count
 */

export interface NLTokenContext {
  /** Resolved metrics from the scoped executor */
  resolved: Record<string, number>;
  /** The primary delta key (e.g. "delta_pct" or "delta_amount") */
  deltaKey?: string;
  /**
   * Historical delta values (oldest → newest) for streak counting.
   * Each element is the delta for one period.
   */
  historicalDeltas?: number[];
}

/**
 * Resolve trend_direction from a delta value.
 * Positive → "increased", negative → "declined", zero → "remained stable".
 */
export function resolveTrendDirection(delta: number): string {
  if (delta > 0.001) return "increased";
  if (delta < -0.001) return "declined";
  return "remained stable";
}

/**
 * Count the streak of same-direction deltas from the end of the array.
 * Returns how many consecutive periods (including the last) have the same sign.
 */
export function resolveConsecutivePeriods(deltas: number[]): number {
  if (!deltas.length) return 0;
  const lastSign = Math.sign(deltas[deltas.length - 1]);
  let streak = 0;
  for (let i = deltas.length - 1; i >= 0; i--) {
    if (Math.sign(deltas[i]) === lastSign) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Replace all NL tokens in a template string with their runtime values.
 *
 * @param template  Template string that may contain {trend_direction}, {consecutive_periods}, etc.
 * @param ctx       Runtime context with resolved metrics and optional history
 * @returns  Template with all supported NL tokens replaced
 */
export function resolveNLTokens(template: string, ctx: NLTokenContext): string {
  let result = template;

  // Resolve {trend_direction}
  if (result.includes("{trend_direction}")) {
    let delta = 0;
    if (ctx.deltaKey && ctx.resolved[ctx.deltaKey] !== undefined) {
      delta = ctx.resolved[ctx.deltaKey];
    } else {
      // Auto-detect: look for delta_pct, delta, delta_amount, pct_change
      for (const key of ["delta_pct", "delta", "delta_amount", "pct_change", "change_pct"]) {
        if (ctx.resolved[key] !== undefined) {
          delta = ctx.resolved[key];
          break;
        }
      }
    }
    result = result.replace(/\{trend_direction\}/g, resolveTrendDirection(delta));
  }

  // Resolve {consecutive_periods}
  if (result.includes("{consecutive_periods}")) {
    const streak = resolveConsecutivePeriods(ctx.historicalDeltas ?? []);
    result = result.replace(/\{consecutive_periods\}/g, String(streak || 1));
  }

  return result;
}
