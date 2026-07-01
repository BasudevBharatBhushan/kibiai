# T-052: Date Breakdown for SQL-Based Classic View

## Status
IMPLEMENTED (pending manual E2E verification against a live SQL source)

## Objective
Make the Classic View **Date Breakdown** control work for SQL-based (nested) reports. It currently only works for FileMaker (flat) reports and does not even appear for SQL reports.

## Problem
1. The Date Breakdown dropdown is hidden for SQL reports because `dateFields` in `configurator/page.tsx` is derived from `Body.BodyField` rows, which are empty in nested SQL mode.
2. The existing client-side breakdown (used by FileMaker) cannot work for SQL: collapsed SQL payloads carry only pre-aggregated group nodes with server-computed totals — no body rows, capped/paginated groups, and server-side grand totals. Client bucketing would be incorrect.

## Approach (server-side re-query)
Treat the date breakdown as a **synthetic outermost `GROUP BY` level** that buckets a date column by Month/Quarter, and re-run the SQL engine.

- Emit the bucket as a real `base` CTE column (`strftime` over `normalizeDateCol`), aliased `"__breakdown.period"`.
- Prepend a synthetic `GroupByField` (level 0) via a shared `effectiveGroupLevels()` helper — never mutating the saved config.
- Format the sortable bucket key (`2025-01` / `2025-Q1`) to a friendly label (`January 2025` / `Q1 2025`) in the structure adapter; keep the raw key for ordering.
- Frontend re-queries `/api/sql-report/generate` with a new `date_breakdown` param and caches the result like the existing print flow.

## Scope
- IN: Date Breakdown for SQL reports (collapsed, drilldown, expand/print).
- OUT: Quick Filters for SQL (explicitly deferred by developer).
- FileMaker client-side breakdown remains untouched.

## Reference
Full design + subagent execution plan: `~/.claude/plans/these-features-are-missing-refactored-treehouse.md`
Plan mirror: `ai-workspace/plans/P-052-sql-date-breakdown.md`
