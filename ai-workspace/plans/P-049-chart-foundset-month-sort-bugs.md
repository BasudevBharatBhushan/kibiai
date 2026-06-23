# P-049 — Implementation Plan: Chart Foundset & Month Sort Fixes

**Ticket:** T-049  
**Status:** AWAITING APPROVAL

---

## Overview

Three targeted changes across three files. No new files needed.

---

## Change 1: Remove ST-8 Absolute Date Filter Stripping

**File:** `src/lib/charts/DataProcessor.ts`  
**Lines:** 258–273

**Current code:**
```typescript
const isViewerMode = !!(context?.reportStart || context?.reportEnd);

const activeFilters = resolvedFilters.filter((rule: string) => {
  const [field, condition] = rule.split(':').map(s => s.trim());
  const isDateField = field.toLowerCase().includes('date');
  
  if (isDateField && isViewerMode) {
    const condValue = condition.replace(/[>=|<=|>|<|==]/g, '').trim();
    const isAbsoluteDate = !isNaN(new Date(condValue).getTime());
    if (isAbsoluteDate) {
      console.log(`[DataProcessor] Skipping hardcoded date filter...`);
      return false;
    }
  }
  return true;
});
```

**Change:** Remove the entire `isViewerMode` guard and the ST-8 stripping block. `activeFilters` becomes simply:
```typescript
const activeFilters = resolvedFilters;
```

The `isViewerMode` variable is no longer needed in this context (the `reportDateRange` object still uses the context values for display, not filtering).

**Rationale:** The AI already uses relative tokens for context-sensitive filters. Absolute dates only appear when the user explicitly requests a specific year/range — and those must be preserved.

---

## Change 2: Add Chronological Sort for Time-Bucketed Labels

### 2a. `src/lib/charts/timeBucket.ts`

Export `MONTH_NAMES` and add `sortTimeLabels()` function:

```typescript
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DOW_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Sorts time-bucketed label strings into chronological order.
 * Only needed for buckets whose string format doesn't sort lexicographically.
 */
export function sortTimeLabels(labels: string[], bucket: TimeBucket): string[] {
  if (bucket === 'month') {
    return [...labels].sort((a, b) => {
      const [ayear, amon] = a.split('-');
      const [byear, bmon] = b.split('-');
      const yearDiff = parseInt(ayear, 10) - parseInt(byear, 10);
      if (yearDiff !== 0) return yearDiff;
      return MONTH_NAMES.indexOf(amon) - MONTH_NAMES.indexOf(bmon);
    });
  }
  if (bucket === 'day_of_week') {
    return [...labels].sort((a, b) => DOW_ORDER.indexOf(a) - DOW_ORDER.indexOf(b));
  }
  // day ("2025-01-15"), week ("2025-W01"), quarter ("2025-Q1"), year ("2025") all sort correctly lexicographically
  return [...labels].sort();
}
```

### 2b. `src/lib/charts/DataProcessor.ts`

Import `sortTimeLabels` and apply it after the labels Set is built (line ~355), but ONLY when there is no explicit `sort_order`/`limit_count` override (those sort by value, which takes precedence):

```typescript
import { bucketDate, TimeBucket, sortTimeLabels } from './timeBucket';

// After line 355 (labels = [...new Set(...)]):
if (group_field_time_bucket && !aiResponse.sort_order && !aiResponse.limit_count) {
  labels = sortTimeLabels(labels, group_field_time_bucket as TimeBucket);
}
```

**Why only when no sort_order/limit_count?**  
When the user asks for "top 10 months by revenue", value-based sorting correctly overrides chronological order. When they ask for "monthly breakdown" with no limit, chronological order is the natural expectation.

---

## Change 3: Clarify Top-N Behavior in AI Instruction

**File:** `src/constants/chartsSystemInstruction.ts`

Add a note under the `Limit Count` field description explaining the ranking basis for comparison charts:

```
Limit Count (limit_count) - optional
- Max items to display. Enforce the 15-SLOT LIMIT RULE.
- For comparison charts (with subgroup_field), the top N is ranked by the combined total across all subgroups/periods.
```

---

## Step-by-Step Implementation Order

1. Edit `timeBucket.ts`: export `MONTH_NAMES`, add `sortTimeLabels()`
2. Edit `DataProcessor.ts`:
   a. Import `sortTimeLabels` from `timeBucket`
   b. Remove ST-8 block (lines 258–273), replace with `const activeFilters = resolvedFilters;`
   c. Add chronological sort after labels Set creation
3. Edit `chartsSystemInstruction.ts`: add top-N clarification note

---

## Risk Assessment

| Change | Risk | Notes |
|--------|------|-------|
| Remove ST-8 | Low-Medium | ST-8 existed to prevent stale dates. Risk: charts with hardcoded past dates (from old configs) may re-emerge. Mitigation: AI instruction already guides relative tokens; only user-generated explicit date filters will be kept. |
| Month sort | Low | Purely additive; only affects insertion order when no explicit sort requested |
| AI instruction update | Minimal | Documentation only |

---

## Test Cases (matches acceptance criteria in T-049)

1. Report with 2025–2026 data → chart filter `>=2025-01-01 AND <=2025-12-31` → only 2025 records shown
2. Report with 2025–2026 data → chart filter `>=2026-01-01` → only 2026 records shown
3. Monthly breakdown chart → labels appear Jan, Feb, Mar … Dec (not Apr, Aug, Dec, Feb …)
4. Comparison chart (2025 vs 2026) with `limit_count: 10` → top 10 by combined total shown
5. "Top 10 customers by revenue" chart → still sorts by value desc
6. `day_of_week` chart → Mon, Tue, Wed … Sun order
