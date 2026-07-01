# L-052: Execution Log — SQL Date Breakdown

## Plan
`ai-workspace/plans/P-052-sql-date-breakdown.md`

## Steps
- [ ] Phase A (Sonnet): `dateBreakdown.ts`, `baseCte.ts`, `builders.ts`
- [ ] Phase B (Sonnet): `structureAdapter.ts`, `sqlReportEngine.ts`, `route.ts`
- [ ] Phase C (Sonnet): `configurator/page.tsx`, `ReportPreview.tsx`
- [ ] Phase D (Haiku): engine unit tests + lint/test
- [ ] Integration: full `npm run lint && npm run test`

## Log
- **Phase A (Sonnet)** — Created `dateBreakdown.ts` (shared contract: `DateBreakdown`, `buildBucketExpr`, `formatBucketLabel`, `parseBucketLabel` [added during integration], `syntheticGroupLevel`, `effectiveGroupLevels`, `isSyntheticBreakdownField`). Exported `normalizeDateCol` from `baseCte.ts`; `buildBaseCte` emits `"__breakdown.period"` bucket column. Threaded `dateBreakdown?` into all four builders. tsc clean (touched files).
- **Phase B (Sonnet)** — Threaded `dateBreakdown?` through `structureAdapter.ts` (synthetic-level label via real date field + `formatBucketLabel` value; added `groupKeyValue` on `NestedGroupNode` so detail rows map to formatted period leaves), `sqlReportEngine.ts` (level count +1, all builder/adapter calls), and `sql-report/generate/route.ts` (parse/validate `date_breakdown`). tsc clean.
- **Phase C (Sonnet)** — `configurator/page.tsx`: SQL `dateFields` derived from setup date-typed fields used in the report (logical `Table.Field`). `ReportPreview.tsx`: `breakdownNestedData` re-query + cache (mirrors print/expand), `activeNestedData` precedence, `date_breakdown` threaded into load-more/expand/print, and `handleDrillDown` group_path rewrite (synthetic period at index 0 via `parseBucketLabel`, real groups shifted). Flat-SQL+breakdown left as `TODO(T-052)` (nested is primary case). No new lint/tsc errors.
- **Phase D (Haiku)** — Added `dateBreakdown.test.ts` (43 tests) + `dateBreakdownQueries.test.ts` (40 tests). All pass.
- **Integration (me)** — Added `parseBucketLabel` inverse to `dateBreakdown.ts` for drill-down. Reverted two OUT-OF-SCOPE files a subagent had touched (`ClassicReportView.tsx` drill-behavior change — harmful to multi-level breakdown; `sqlReportsSystemInstruction.ts` filter-operator prompt edit — unrelated).

## Gates
- `npx tsc --noEmit`: clean in all source; only 6 pre-existing errors in `src/lib/sql/__tests__/` fixtures (missing `joined_table`/`join_type`, OpenAI type) — predate this ticket.
- `npx vitest run src/lib/sql`: **184 passed**, 0 failed (7 pre-existing skipped suites).
- ESLint on changed files: 0 new errors (pre-existing `any`/unused warnings remain in `configurator/page.tsx` and `sqlReportEngine.ts`).

## Follow-ups
- Flat SQL reports (no group-by) + breakdown: currently render via `FlatRowTable` before the re-query fires. Deferred — see `TODO(T-052)` in `ReportPreview.tsx`.
- Manual E2E verification (verification steps in `P-052`) still to be run against a live SQL data source.
