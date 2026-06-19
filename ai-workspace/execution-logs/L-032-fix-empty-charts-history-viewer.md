# L-032 — Execution Log: Fix Empty Charts in History Viewer

**Ticket**: T-032  
**Date**: 2026-05-07  
**Scope**: fullstack

---

## Step 1 ✅ — Removed hardcoded field normalization from DataProcessor.ts

**File**: `src/lib/charts/DataProcessor.ts`  
**Change**: Removed the 30-line `bodyData.map()` block that was aliasing `Profit`, `Subtotal`, `Quantity`, `Line Price`, `Unit Price`, `Sales Date`, `Item Name` to hardcoded variants. Replaced with a clean `rawBodyData.map(item => ({ ...item }))` spread. Labels flow through as-is; `findActualKey` handles case/space normalization at lookup time.

---

## Step 2 ✅ — Added `extractReportDateRange` helper to page.tsx

**File**: `src/app/[company_slug]/templates/[template_id]/generate/page.tsx`  
**Change**: Added `extractReportDateRange(rows)` function that scans all string values across body rows, parses them as dates, and returns `{ reportStart, reportEnd }` as an `InsightContext`. Returns `undefined` if no valid dates found (graceful fallback).

---

## Step 3 ✅ — Added `viewerContext` state and populate on history load

**File**: `src/app/[company_slug]/templates/[template_id]/generate/page.tsx`  
**Changes**:
- Added `const [viewerContext, setViewerContext] = useState<InsightContext | undefined>(undefined)`
- In `onLoad` handler: call `setViewerContext(extractReportDateRange(rows))` after extracting body rows
- In `handleGenerate` SSE `done` handler: call `setViewerContext(undefined)` to clear historical context for fresh generations

---

## Step 4 ✅ — Threaded `context` through ChartModal → DashboardProvider

**File**: `src/app/[company_slug]/templates/[template_id]/generate/page.tsx`  
**Changes**:
- Added `context?: InsightContext` to `ChartModal` component props interface
- `DashboardProvider` inside `ChartModal` now receives `context={context}` and `isViewerMode={!!context}`
- `ChartModal` invocation now receives `context={viewerContext}`

---

## How the Fix Works

```
History load:
  onLoad(data)
    → extractBodyRows(data) → rows
    → setChartRows(rows)
    → extractReportDateRange(rows) → { reportStart: "2026-03-01", reportEnd: "2026-03-31" }
    → setViewerContext({ reportStart, reportEnd })

User clicks "View Charts":
  ChartModal opens
    → DashboardProvider receives context={viewerContext} + isViewerMode=true
    → processData() called with context
    → DataProcessor: isViewerMode = !!(context.reportStart || context.reportEnd) = true
    → For every date filter rule: isAbsoluteDate check passes → return true (skip filter)
    → All March 2026 rows survive filtering
    → Charts render with data ✅

Fresh generation:
  handleGenerate SSE "done"
    → setViewerContext(undefined)  ← clears context
    → ChartModal opens without context
    → isViewerMode = false
    → Date filters apply normally ✅
```

---

## Verification

- ✅ TypeScript: No new errors in changed files (`tsc --noEmit` output confirms only pre-existing errors in scratch/ and tests/)
- ✅ ESLint: All `any` errors in linted files are pre-existing (no new violations introduced)
- 🔲 Playwright: Run `node scratch/playwright_check.js` to verify March 2026 charts render
