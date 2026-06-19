# P-032 — Implementation Plan: Fix Empty Charts in History Viewer

**Ticket**: T-032  
**Status**: PENDING APPROVAL  
**Scope**: fullstack  
**Estimated Steps**: 3

---

## Executive Summary

Charts are empty when loading historical reports because the `DashboardProvider` inside `ChartModal` never receives an `InsightContext`. Without it, `DataProcessor.isViewerMode` is always `false`, so hardcoded absolute date filters (all set for April 2026) eliminate all March 2026 data rows. The fix requires:
1. Extracting a date range from the historical report's data at load time.
2. Threading that `context` into `ChartModal` → `DashboardProvider`.
3. Minor field-name normalization guards.

---

## Step 1 — Extract Report Date Range on History Load
**File**: `src/app/[company_slug]/templates/[template_id]/generate/page.tsx`

Add a helper `extractReportDateRange(data)` that parses the `Invoice Date` (or any date field) from body rows to derive `{ reportStart: string, reportEnd: string }`.

Add state: `const [viewerContext, setViewerContext] = useState<InsightContext | undefined>(undefined);`

In the `onLoad` handler (line 753):
```ts
onLoad={data => {
  setReportData(data);
  const rows = extractBodyRows(data);
  setChartRows(rows);
  // NEW: Extract date range for viewer mode
  const context = extractReportDateRange(rows);
  setViewerContext(context);
  // ... existing heading/dispatch logic
}}
```

**Helper function** (add near top of file):
```ts
function extractReportDateRange(rows: any[]): InsightContext | undefined {
  const dates: Date[] = [];
  rows.forEach(row => {
    const val = row['Invoice Date'] ?? row['InvoiceDate'] ?? row['Sales Date'] ?? row['Date'];
    if (val) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) dates.push(d);
    }
  });
  if (!dates.length) return undefined;
  dates.sort((a, b) => a.getTime() - b.getTime());
  return {
    reportStart: dates[0].toISOString().split('T')[0],
    reportEnd: dates[dates.length - 1].toISOString().split('T')[0],
  };
}
```

---

## Step 2 — Thread `context` Through `ChartModal`
**File**: `src/app/[company_slug]/templates/[template_id]/generate/page.tsx`

Update the `ChartModal` interface and component to accept and forward `context`:

```ts
// Add to ChartModal props interface:
context?: InsightContext;

// In ChartModal JSX — pass to DashboardProvider:
<DashboardProvider
  initialSchemas={schemas}
  initialDataset={rows}
  initialCanvasState={canvasState}
  initialLayoutMode={layoutMode}
  templateId={templateId}
  context={context}       // ← NEW
  isViewerMode={!!context} // ← NEW: lock editing for historical reports
>
```

Update the `ChartModal` invocation (line 960):
```tsx
<ChartModal
  ...
  context={viewerContext}  // ← NEW
/>
```

---

## Step 3 — Clear `viewerContext` on Fresh Generation
**File**: `src/app/[company_slug]/templates/[template_id]/generate/page.tsx`

In `handleGenerate` (the SSE "done" event handler), reset viewer context since this is live data:
```ts
setViewerContext(undefined); // ← NEW: fresh generation is NOT a historical view
```

---

## Verification

After implementation:
1. Run `playwright_check.js` — should see `[DataProcessor] Skipping hardcoded date filter` in browser console
2. Charts for March 2026 report should show data
3. Newly generated reports (no `viewerContext`) should still respect their own date filters
4. Run `npm run lint && npm run build` to ensure no regressions

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `isViewerMode=true` disabling chart editing | Only set when `context` is present (history load path) |
| Date extraction fails for some date formats | Return `undefined` gracefully — falls back to non-viewer mode |
| Breaking fresh generation | `setViewerContext(undefined)` on `handleGenerate` clears it |
