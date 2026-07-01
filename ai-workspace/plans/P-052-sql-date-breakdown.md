# P-052: Date Breakdown for SQL-Based Classic View

Full design lives in `~/.claude/plans/these-features-are-missing-refactored-treehouse.md` (approved). Summary below for the repo record.

## Design
The SQL engine builds reports as a stack of `GROUP BY` levels read generically from `config.group_by_fields`. Add **one synthetic level-0 group** whose column is a computed date-bucket expression, so all existing per-level logic works unchanged.

**A. Bucket as a real `base` column** — `buildBaseCte` appends
`<bucketExpr(normalizeDateCol("<date col>"))> AS "__breakdown.period"`.
- Month → `strftime('%Y-%m', <col>)` → `2025-01`
- Quarter → `strftime('%Y', <col>) || '-Q' || ((CAST(strftime('%m', <col>) AS INT)+2)/3)` → `2025-Q1`

**B. Synthetic level-0 group** via `effectiveGroupLevels(config, dateBreakdown)` = `[SYNTHETIC, ...groupLevels(config)]`. SYNTHETIC carries the report summary fields as `group_total` so each period shows subtotals.

Synthetic-aware spots: `buildBaseCte` (emit bucket, skip resolveField), the label/value resolver in `structureAdapter` (`formatBucketLabel`), and the shared `effectiveGroupLevels` helper.

## Files
- NEW `src/lib/sql/dateBreakdown.ts` — types, `buildBucketExpr`, `formatBucketLabel`, `effectiveGroupLevels`, synthetic constants.
- `src/lib/sql/baseCte.ts` — bucket column; export `normalizeDateCol`.
- `src/lib/sql/builders.ts` — thread `dateBreakdown`, use `effectiveGroupLevels`.
- `src/lib/sql/sqlReportEngine.ts` — thread param, level count +1.
- `src/lib/sql/structureAdapter.ts` — synthetic level label/value.
- `src/app/api/sql-report/generate/route.ts` — parse/validate `date_breakdown`.
- `src/app/[company_slug]/templates/[template_id]/configurator/page.tsx` — SQL `dateFields` from setup field defs.
- `src/components/ReportPreview.tsx` — breakdown re-query + cache + drill/expand/print threading.

No changes: `ClassicViewSettingsSection.tsx`, `ReportConfigurator.tsx`, `ClassicReportView.tsx`.

## Subagent execution
- Phase A (Sonnet): dateBreakdown.ts + baseCte.ts + builders.ts
- Phase B (Sonnet): structureAdapter.ts + sqlReportEngine.ts + route.ts
- Phase C (Sonnet): configurator + ReportPreview
- Phase D (Haiku): engine unit tests + lint/test gates
Order: A → B → (C ∥ D).
