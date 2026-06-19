# Ticket: T-039 — Report Preview Performance Optimisation

## Status: COMPLETED

## Description
Large reports (500+ rows) cause multi-second UI freezes on the report viewer/configurator page.
Root causes are all in the frontend rendering pipeline:
1. `generateDynamicReport()` runs synchronously on the main thread, blocking paint.
2. `runPagination()` reads `el.offsetHeight` per-element, causing O(n) forced browser reflows.
3. `useMemo` in `page.tsx` depends on the full `report` object instead of a stable ID.
4. All DOM nodes exist in the DOM even when hidden, causing full layout costs.

## Scope
- `frontend`

## Files in Scope
- `src/components/DynamicReportPreview.tsx`
- `src/app/[company_slug]/reports/[report_id]/page.tsx`
- `src/styles/dynamicreport.css`

## Out of Scope
- No backend / API route changes.
- No changes to `generateDynamicReport` internal logic / data transformation.

## Sub-tasks
- [x] Fix 1 — Defer HTML generation to post-paint (setTimeout 0)
- [x] Fix 2 — Batch DOM reads in runPagination (eliminate per-element reflows)
- [x] Fix 3 — `content-visibility: auto` CSS on level-0 subsummaries
- [x] Fix 4 — Stable useMemo dep on report_id in page.tsx
- [x] Fix 5 — Loading skeleton/progress overlay during calculation


## Description
Large reports (500+ rows) cause multi-second UI freezes on the report viewer/configurator page.
Root causes are all in the frontend rendering pipeline:
1. `generateDynamicReport()` runs synchronously on the main thread, blocking paint.
2. `runPagination()` reads `el.offsetHeight` per-element, causing O(n) forced browser reflows.
3. `useMemo` in `page.tsx` depends on the full `report` object instead of a stable ID.
4. All DOM nodes exist in the DOM even when hidden, causing full layout costs.

## Scope
- `frontend`

## Files in Scope
- `src/components/DynamicReportPreview.tsx`
- `src/app/[company_slug]/reports/[report_id]/page.tsx`
- `src/styles/dynamicreport.css`

## Out of Scope
- No backend / API route changes.
- No changes to `generateDynamicReport` internal logic / data transformation.

## Sub-tasks
- [ ] Fix 1 — Defer HTML generation to post-paint (setTimeout 0)
- [ ] Fix 2 — Batch DOM reads in runPagination (eliminate per-element reflows)
- [ ] Fix 3 — `content-visibility: auto` CSS on level-0 subsummaries
- [ ] Fix 4 — Stable useMemo dep on report_id in page.tsx
- [ ] Fix 5 — Loading skeleton/progress overlay during calculation
