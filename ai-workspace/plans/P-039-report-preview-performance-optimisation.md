# Implementation Plan: T-039 — Report Preview Performance Optimisation

## Overview
Five sequential frontend-only changes to eliminate UI freezes on large report previews.
No backend logic is touched.

---

## Step 1 — Defer HTML generation to post-paint
**File**: `src/components/DynamicReportPreview.tsx`  
**Lines**: ~215-220 (`useEffect` — Generate HTML)

Replace the synchronous call with a `setTimeout(0)` pattern so the loading state paints
before the CPU-heavy work starts. Also set `isCalculating(true)` here (not only in runPagination)
so the UI shows the spinner instantly.

```tsx
useEffect(() => {
  if (jsonData?.length > 0) {
    setIsCalculating(true);   // show spinner immediately
    const id = setTimeout(() => {
      const html = generateDynamicReport(jsonData, metadata);
      setReportHtml(DOMPurify.sanitize(html));
    }, 0);
    return () => clearTimeout(id);
  }
}, [jsonData, metadata]);
```

---

## Step 2 — Batch DOM reads in runPagination
**File**: `src/components/DynamicReportPreview.tsx`  
**Lines**: ~253-333 (`runPagination` function)

Restructure into two explicit passes:
- **Pass 1**: collect all atomic elements into a flat array, then read ALL their `offsetHeight`
  values in a single loop → stored in a `heights[]` array. This triggers ONE browser layout.
- **Pass 2**: iterate `heights[]` to assign `data-page` attributes (writes only, no reads).
  No layout flushes occur during write-only pass.

---

## Step 3 — content-visibility: auto on subsummary blocks
**File**: `src/styles/dynamicreport.css`

Add CSS containment to top-level subsummary groups so the browser skips off-screen layout
and paint. Requires an estimated intrinsic size so scroll height stays correct.

```css
.subsummary.level-0 {
  content-visibility: auto;
  contain-intrinsic-size: 0 300px;
}
```

---

## Step 4 — Stable useMemo dependency in page.tsx
**File**: `src/app/[company_slug]/reports/[report_id]/page.tsx`  
**Lines**: ~81-87

Change `useMemo([report])` → `useMemo([report?.report_id])`.
The full `report` object is reconstructed on each API response parse, so referential equality
always fails even when data is identical. Using the stable `report_id` string prevents
redundant re-renders.

---

## Step 5 — Progress overlay during calculation
**File**: `src/components/DynamicReportPreview.tsx`  
**Lines**: ~656-674 (the A4 paper div)

Replace the current `opacity: isCalculating ? 0.5 : 1` with an absolute-positioned overlay
div containing a progress bar animation and "Rendering report…" label. This makes the wait
feel intentional rather than broken.

---

## Verification
- [ ] Run `npm run lint` — no new errors
- [ ] Run `npm run build` — clean build
- [ ] Manually test with a large report (500+ rows) — no UI freeze during load
- [ ] Pagination must still work correctly after batching fix
