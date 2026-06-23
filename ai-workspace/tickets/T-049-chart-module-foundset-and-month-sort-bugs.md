# T-049 — Chart Module: Foundset Year Filtering & Month Sort Bugs

**Status:** COMPLETED  
**Priority:** High  
**Reporter:** Developer  
**Branch:** `fix/T-049-chart-foundset-month-sort`

---

## Description

Two bugs identified in the chart generation module, plus one design clarification needed.

---

## Bug 1: Absolute Date Filters Stripped in Viewer Mode (Foundset Not Constrained)

### Symptom
When a report dataset spans 2025–2026, asking the AI to generate a chart "only for 2025" (or "only for 2026") does not constrain the data — the chart renders all records from the full report range.

### Root Cause
`DataProcessor.ts` lines 258–273 implement "ST-8" — a rule that strips **all** hardcoded absolute date filters when in viewer mode (`isViewerMode = !!(reportStart || reportEnd)`).

The original intent was to prevent stale absolute dates (e.g., a "last 3 months" filter baked in as `>=2024-10-15` at generation time) from persisting when the report is re-run at a different time.

However, the rule is too broad: it also strips **intentional** year-range filters the AI generates on behalf of the user (e.g., `"Invoice Date: >=2025-01-01"` and `"Invoice Date: <=2025-12-31"`).

### Why the Original Problem Is Already Solved Without ST-8
The AI system instruction (`chartsSystemInstruction.ts`) already instructs the AI to use **relative date tokens** (`TODAY`, `TODAY - X Months`, `REPORT_START`, `REPORT_END`) for context-sensitive filtering. Absolute dates only appear in filters when the user explicitly requests a specific time range. Stripping them breaks user intent.

---

## Bug 2: Month Labels Out of Order in Time-Bucketed Charts

### Symptom
Charts with a monthly breakdown show months in incorrect order (e.g., April before January).

### Root Cause
`timeBucket.ts` line 28 generates month labels as `"YYYY-Mon"` (e.g., `"2025-Jan"`, `"2025-Apr"`).

In `DataProcessor.ts` line 355, labels are extracted as:
```typescript
let labels = [...new Set(filteredData.map(getGroupKey).filter(Boolean))];
```
`new Set()` preserves **insertion order**, not sorted order. No explicit sort is applied afterward (unless `sort_order`/`limit_count` is set, which sorts by value).

Lexicographic sort would also fail because `"Apr" < "Jan"` alphabetically — so months cannot be sorted by their string representation alone.

---

## Design Question: Top N in Comparison Charts

### Question
If a user asks for a comparison chart (e.g., 2025 vs 2026) limited to "top 10", by what criterion should the top 10 be selected?

### Current Behavior (DataProcessor.ts lines 383–408)
The top N is determined by **summing each group-field label's value across ALL subgroups** (both years), then taking the top `limit_count` by that combined total.

Example: For "Top 10 customers, compare 2025 vs 2026" — customers are ranked by their combined 2025+2026 revenue. The top 10 by combined revenue are shown.

### Assessment
This is a reasonable default. Alternatives would be:
- Top 10 by most recent period only (favors recent growth)
- Top 10 by absolute growth (difference between periods)

**Recommendation:** Keep the current combined-total approach as the default, but add a clear note in the AI system instruction so the AI understands and communicates this to the user.

---

## Files Affected

| File | Change |
|------|--------|
| `src/lib/charts/DataProcessor.ts` | Remove ST-8 absolute date stripping; add chronological sort for time-bucketed labels |
| `src/lib/charts/timeBucket.ts` | Export `MONTH_NAMES`; add `sortTimeLabels()` helper |
| `src/constants/chartsSystemInstruction.ts` | Clarify top-N behavior for comparison charts |

---

## Acceptance Criteria

- [ ] A chart generated with filter `"Invoice Date: >=2025-01-01"` on a 2025–2026 report shows only 2025 data
- [ ] A chart generated with filter `"Invoice Date: >=2026-01-01"` on a 2025–2026 report shows only 2026 data
- [ ] A monthly breakdown chart (`group_field_time_bucket: "month"`) displays months in chronological order (Jan → Feb → … → Dec)
- [ ] A comparison chart with `limit_count: 10` still correctly shows the top 10 by combined total
- [ ] A "top 10 customers" non-comparison chart (no time bucket, explicit `sort_order: desc`) still sorts by value correctly
- [ ] `day_of_week` bucket also sorts in Mon–Sun order
