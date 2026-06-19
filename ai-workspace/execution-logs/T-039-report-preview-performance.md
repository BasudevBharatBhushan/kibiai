# Execution Log: T-039 — Report Preview Performance Optimisation
**Date**: 2026-05-18
**Scope**: frontend

## Steps Completed

### Fix 1 — Defer HTML generation to post-paint
- File: `src/components/DynamicReportPreview.tsx` (lines 214-224)
- Wrapped `generateDynamicReport` + `DOMPurify.sanitize` in `setTimeout(0)`
- Added `setIsCalculating(true)` before the timeout so spinner appears immediately
- Added cleanup `clearTimeout` in the effect return

### Fix 2 — Batch DOM reads in runPagination
- File: `src/components/DynamicReportPreview.tsx` (lines 253-342)
- Restructured pagination into explicit 2-pass system:
  - Pass 1: collect all atomic elements, batch-read all `offsetHeight` values at once
  - Pass 2: use pre-read `heights[]` array to assign data-page (writes only)
- Reduced O(n) forced browser reflows to a single layout flush

### Fix 3 — content-visibility: auto on subsummaries
- File: `src/styles/dynamicreport.css` (lines 65-76)
- Added `content-visibility: auto` + `contain-intrinsic-size: 0 300px` to `.subsummary.level-0`
- Added `@media print` override to reset these for PDF exports
- Added `@keyframes reportProgress` for the progress bar animation

### Fix 4 — Stable useMemo dependency
- File: `src/app/[company_slug]/reports/[report_id]/page.tsx` (lines 81-90)
- Changed dependency from full `report` object to `report?.report_id` (stable string)
- Prevents redundant metadata recomputation on unrelated parent re-renders

### Fix 5 — Progress overlay during calculation
- File: `src/components/DynamicReportPreview.tsx` (lines 665-720)
- Added loading overlay with animated progress bar for both previewMode and A4 mode
- Replaced simple `opacity: 0.5` with proper overlay card + animated fill bar
- Used CSS `animation: reportProgress` for the sweeping bar effect

## Verification
- `npx eslint` on changed files: 0 new errors introduced (pre-existing any/prefer-const issues in generation logic unchanged)
- `npm run build`: Exit code 0, all 36 static pages generated successfully
