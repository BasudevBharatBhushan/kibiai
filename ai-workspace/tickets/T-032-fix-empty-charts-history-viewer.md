# T-032 — Fix: Empty Charts When Viewing Historical Reports [COMPLETED]

**Status**: TODO  
**Scope**: fullstack  
**Priority**: HIGH  
**Created**: 2026-05-07

---

## Problem Statement

When a user loads a historical report from the **Report History** section (e.g., "Revenue and Profit Summary by Contact and Invoice – March 2026"), clicking **View Charts** displays empty charts with no data.

---

## Root Cause Analysis (3 Confirmed Bugs)

### Bug #1 — Missing `InsightContext` → `isViewerMode` never activates [PRIMARY CAUSE]
- **Location**: `src/app/[company_slug]/templates/[template_id]/generate/page.tsx` → `ChartModal` component
- **Problem**: When history `onLoad` fires, it sets `chartRows` but **never extracts a date range** from the historical report. The `ChartModal` renders `DashboardProvider` without a `context` prop. Therefore, inside `DataProcessor.ts`, `isViewerMode` is always `false`.
- **Effect**: The `isViewerMode` bypass logic (lines 174-182 of DataProcessor) never executes, so hardcoded absolute date filters are NOT skipped.

### Bug #2 — Chart Templates Hardcoded for April 2026 Dates
- **Location**: `chart_templates` table — all schemas have `filters: ["Invoice Date: >=04/01/2026", "Invoice Date: <=04/30/2026"]`
- **Problem**: When viewing the March 2026 report, the `DataProcessor.filterData` step removes all rows because March dates don't match the April filter.
- **Effect**: Zero rows remain after filtering → empty charts.

### Bug #3 — Field Name Mismatch (`LineRevenue` vs `Line Revenue`)
- **Location**: `DataProcessor.ts` → `findActualKey` function
- **Problem**: Chart schemas use `LineRevenue`, `LineProfit`, `TotalInvStatic` (camelCase), but the actual report data body rows use `Line Revenue`, `Line Profit`, `Total Invoice` (space-separated). While `findActualKey` strips spaces during lookup (which should help), the `bodyData` normalization step (lines 83-93) only normalizes a fixed set of fields.
- **Effect**: `numerical_field` lookup may fail for fields not in the hardcoded normalization list.

---

## Files to Modify

1. `src/app/[company_slug]/templates/[template_id]/generate/page.tsx`
   - Extract `reportStart` / `reportEnd` from historical report data on history load
   - Pass `context` prop to `ChartModal` 
   - `ChartModal` must forward `context` to `DashboardProvider`

2. `src/lib/charts/DataProcessor.ts`  
   - Ensure `findActualKey` is also used on `filteredData` rows (not just `bodyData[0]`)
   - Already has `isViewerMode` logic — just needs context to be passed correctly

---

## Acceptance Criteria

- [ ] Loading "March 2026" from Report History and clicking "View Charts" shows populated charts
- [ ] The `[DataProcessor] Skipping hardcoded date filter` log appears in browser console
- [ ] Numerical fields like `Line Revenue`, `Line Profit` resolve correctly despite camelCase schema names
- [ ] No regression on newly generated reports (fresh generation still works with date filters)
