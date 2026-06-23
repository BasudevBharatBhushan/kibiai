# L-049 — Execution Log: SQLite Source Report Engine

Ticket: T-049 · Plan: P-049

## Ticket 1 — Collapsed view (MVP)

### Setup
- Created `T-049` ticket, `P-049` plan; added `T-049` to `ai-workspace/active-ticket`.

### Wave A — DONE
- SA-1 (Sonnet): `src/lib/sql/{types,sqlClient,identifiers}.ts` — types + `isSqlSetup`, HTTP client (`runQuery`/`fetchSchema`/`checkHealth` + `assertReadOnly` SELECT-only guard + `SqlClientError`), identifier quoting/allow-list resolvers.
- SA-2 (Opus): `src/constants/sqlReportsSystemInstruction.ts` — `SQL_REPORTS_SYSTEM_INSTRUCTION`; same `ReportConfig` output schema as FM, SQL GROUP BY / JOIN / aggregate semantics, V1 forbids pivot/window analytics.

### Wave B — DONE
- SA-3 (Opus): `src/lib/sql/{baseCte,builders,formulaToSql}.ts` — generator 0 (`buildBaseCte`), generators 1–4 (`buildGroupAggregationQuery`/`buildCountQuery`/`buildDetailQuery`/`buildGrandSummaryQuery`), `compileFormula` (row-level → SQL with `NULLIF` div-guard, allow-listed funcs). FM filter operators mirrored; all values bound as `?`, identifiers via allow-list. Calc alias = `calculated.<name>`.

### Wave C — DONE
- SA-4 (Sonnet): `src/lib/sql/{structureAdapter,sqlReportEngine.ts}` — `runSqlReport` (collapsed fully implemented; drilldown/expand_all/print stubbed for T2/T3). Returns BOTH FM-shaped `report_structure_json` (empty Body) and typed `NestedReport` tree. Labels/prefix/suffix mapped from setup fields.

### SA-5 — DONE (solo; existing-file edits)
- NEW `src/app/api/sql-report/generate/route.ts` (mirrors FM envelope: `{success,status,report_structure_json,nested,row_count,warn_large,processing_logs}`).
- EDIT `templates/[id]/generate/route.ts` + `.../generate/stream/route.ts`: additive `isSql` branch on `req.nextUrl.origin` engine URL; FM `else` path byte-for-byte unchanged.
- EDIT `company/templates/[id]/setup/route.ts` PUT: source-aware validation (`sql` branch vs unchanged FM `else`).
- AI-instruction branch found to live in frontend configurator (`[company_slug]/templates/[id]/configurator/page.tsx`) — branched `instructionSet` on `data_source_type`.

### SA-6 — DONE (tests + regression)
- NEW `src/lib/sql/__tests__/sql-engine.test.ts`: **80 passed / 2 skipped** (live-API smoke guarded by `SQL_LIVE` env). Covers identifiers, SELECT-only guard, all 4 builders ({sql,params} + no-inlined-values + unknown-field throws), formula→SQL, structure adapter, sqlClient 401/403 mapping.
- FM regression verified: `generate-report/route.ts` unmodified; FM setup validation unchanged; `isSqlSetup` is the sole branch gate.

### Verification
- `npx tsc --noEmit`: zero NEW errors (only the pre-existing `template-2342f0f0-charts.test.ts` TS2322 remains).

### Ticket 1 status: COMPLETE — paused for developer review before Ticket 2.

---

## Ticket 2 — Drill-down + classic nested viewer

DB check (Supabase MCP): `report_templates.report_template_setup_json` / `report_template_config_json`
are JSONB — SQL sources reuse them, **no migration required**. No SQL templates exist yet.

### SA-7 — DONE (drill-down engine path, Sonnet)
- `structureAdapter.ts`: `buildDrilldownResult(config,setup,rows)` → `{ bodyRows(label-keyed), fieldOrder, fieldPrefix, fieldSuffix, totalFields, totals }`.
- `sqlReportEngine.ts`: implemented `drilldown` mode — `buildCountQuery(groupFilter)` → if `row_count > LARGE_ROW_THRESHOLD && !confirmLarge` return `{warn_large:true,row_count}` (no fetch); else `buildDetailQuery(groupFilter)` → `group_rows`. `LARGE_ROW_THRESHOLD = 30_000` exported from `types.ts`.
- Route returns `group_rows`/`row_count`/`warn_large`. Tests: **92 passed / 2 skipped** (added drilldown adapter + mocked warn-large/normal/confirm paths).

### SA-8 — DONE (ClassicReportView nested mode, Opus)
- Additive props `mode`/`nestedData`/`onDrillDown`; exported `DrillRequest`. `nestedRows` memo maps `NestedReport.groups` → existing `RowSpec[]` (same `groupId` convention) so collapse/expand/pagination reused. `ss` gains optional `totals`/`count`/`drillable`. Totals/grand-totals READ pre-computed values in nested mode, reduce in flat. Async `handleNestedDrill` (window.confirm >30k → loading → `onDrillDown` → DrillModal; stale-result guard). **Flat path untouched** (all original logic in the `else` branches; hooks unconditional).

### SA-9 — DONE (ReportPreview wiring + type reconcile, Sonnet)
- Reconciled `NestedGroupNode` (added optional `totalFields`/`bodyRows`; collapsed adapter sets `totalFields`); removed SA-8's local workaround type.
- Data path: engine `nested` → SSE `done.nested_report` (stream route) → configurator dispatches `SET_REPORT_PREVIEW {report_structure_json, nested_report}` → `ReportPreview` detects nested payload, uses engine's `report_structure_json` as FM scaffold, passes `mode/nestedData/onDrillDown` to ClassicReportView.
- `handleDrillDown`: zips `req.groupPath` (value = `String(node.value)`) with ordered `Object.values(config.group_by_fields)` → logical `group_path:[{table,field,value}]`; POSTs via `apiClient` with `confirm_large` when count>threshold; returns `group_rows`. Flat + print paths unchanged.

### Verification
- `npx tsc --noEmit`: zero NEW errors (only pre-existing charts-test).
- `npx vitest run src/lib/sql/__tests__/sql-engine.test.ts`: **92 passed / 2 skipped**.
- eslint touched files: no NEW errors (4 `any` errors in stream route are pre-existing; remaining warnings pre-existing).

### Ticket 2 status: COMPLETE — paused for developer review before Ticket 3 (expand-all + print).

---

## Ticket 3 — Expand-all + print + live test

Live SQLite server (`https://kiflow.kibizsystems.com/sqlite`, key `123456`): healthy, read-only.
Tables: invoice (105,436), invoice_line_item (303,027), product, purchase_order,
purchase_order_line_item. Numeric columns are clean numeric strings → SQLite SUM coerces.

### SA-10 — DONE (expand-all/print engine assembly, Sonnet; agent dropped on final report but edits landed)
- `structureAdapter.buildExpandedNestedReport(config,setup,levelRows,detailRows,grandRow)`: builds the group tree (headers/totals) then DISTRIBUTES detail rows into leaf `bodyRows` (label-keyed, order preserved); empty leaves → `bodyRows:[]`.
- `sqlReportEngine.runExpandAll` (handles `expand_all` + `print`): global COUNT → if >30k & !confirm return `warn_large`; else per-level aggregation + full detail + grand summary → `buildExpandedNestedReport` + collapsed FM scaffold.

### SA-11 — DONE (DynamicReportPreview nested print, Opus)
- Additive `mode`/`nestedData` props. Extracted `renderBodyTableHtml` (identical markup) — flat path sorts then calls it; nested calls it directly (no re-sort, SQL already ordered). `generateNestedReportFromTree` reuses the exact subsummary/section-total/trailing-summary templates + class names → **print is pixel-identical**; pagination/export untouched.

### SA-12 — DONE (expand-all wiring + tests, Sonnet; agent dropped mid-render-wiring — finished by orchestrator)
- `ReportPreview`: `fetchExpandAll` (warn→confirm→refetch), `handleExpandAll` ("See all data"/"Collapse" toggle), `fetchPrintNestedData` (lazy on entering print). **Orchestrator completed the JSX wiring** the drop left unfinished: rendered the "See all data" button (nested only), passed `activeNestedData` to ClassicReportView, and `mode`/`printNestedForDynamic` to DynamicReport.
- Tests (orchestrator authored, since SA-12 dropped before Job B): `buildExpandedNestedReport` single- + two-level (distribution, order, label keys, empty leaf, internal-node children, grand totals) and `runSqlReport expand_all` mocked (warn-large short-circuit / normal 4-query assembly / confirmLarge). **101 passed / 2 skipped.**

### Live end-to-end validation (NEW)
- Created test template **`79a97510-f595-4a5b-9ff8-83be52de0820`** ("SQL Sales Report (SQLite Test)", company `90f69fd1…`, Sales module) with a SQL setup_json over `invoice_line_item` (+`invoice` join). No migration needed.
- `src/lib/sql/__tests__/sql-live-e2e.test.ts` (guarded by `SQL_LIVE=1`) drives `runSqlReport` against the real server for all modes: collapsed (ProductType groups + $72.5M total), drilldown huge group → warn_large, expand_all unfiltered (303k) → warn_large, expand_all filtered (Manufacturer=CHURCH ~768) → assembles nested tree with bodyRows (body count == row_count). **4/4 pass** (run with sandbox network enabled).

### Verification
- `npx tsc --noEmit`: zero NEW errors. Unit suite **101 passed / 2 skipped**. Live e2e **4/4**.
- ReportPreview lints clean; DynamicReportPreview new code clean (pre-existing flat `prefer-const`/`any` untouched).

### Ticket 3 status: CODE COMPLETE. Remaining = manual UI test (AI config generation in the
configurator + on-screen render of collapsed/drill-down/expand-all/print) on the test template —
requires the running dev server (cannot be driven headlessly from here).
