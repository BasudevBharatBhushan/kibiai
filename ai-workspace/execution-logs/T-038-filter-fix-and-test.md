# Execution Log: T-038 Filter Fix + Test Results

**Date:** 2026-05-13
**Status:** IN_PROGRESS

---

## Bugs Fixed

### Bug 1 — Filters wiped when navigating away and back
**Root Cause:**  
`ReportFiltersSection` uses two `useEffect` hooks: Effect 1 loads rows from context, Effect 2 syncs rows back to context. On component remount:
- `filterRows`/`dateRows` reset to `[]` (useState re-initializes)
- Effect 2 fires immediately with empty rows → dispatches `SYNC_FILTERS({})` → **wipes the context**
- Effect 1 fires afterwards and re-loads, but the damage is done — the save API was already triggered with empty config by the "Update" button or auto-save

**Fix:**  
Added `isDateInitialized` / `isFilterInitialized` refs. Set them to `true` inside Effect 1 after the rows are loaded. Effect 2 now guards: `if (!isInitialized.current) return;` so it never dispatches empty config on mount.

### Bug 2 — Filter value not loading if rawValue is a non-string type
**Root Cause:**  
`rawValue` from `state.config.filters` (loaded from Supabase `jsonb`) could be a number or other non-string type. Calling `.startsWith()` on it directly throws a runtime error.

**Fix:**  
Added `const strVal = String(rawValue ?? "")` before operator parsing.

---

## Q4 2025 Test Results (FileMaker Performance)

| Step | Table | Records | foundCount | Time |
|------|-------|---------|------------|------|
| 1 | MaterialLineItemArchived (Q4 date + qty>0) | 5,000 | 9,551 | 5.8s |
| 2 | LineItemArchived join (3,860 ItemNo) | 5,000 | 18,749 | **69.5s** |
| 3 | PRD sample join (200 ItemNo) | 230 | - | 2.8s |

**Assessment:**
- The Q4 range reduces total records from 175k to ~28k
- BUT the join query on `LineItemArchived` with 3,860 unique `ItemNo` values still takes **~70 seconds** — this is the FileMaker query limitation, not our code
- Total pipeline time for this template will exceed the 30-second gateway timeout
- The `foundCount` on `MaterialLineItemArchived` is 9,551 — meaning 5,000 limit is only fetching the first batch; multiple pages would be needed

**Conclusion:** The template as configured cannot be generated within normal web request timeouts due to FileMaker's query performance with large batched `OR` conditions. Even the 3-month range is too heavy.

**Recommendation for User:**
1. Further narrow the date range (e.g., one month)
2. Or the backend needs a pagination + background-job approach for large datasets
