# Module: SQL Report Engine (SQLite-first)

> Read this before touching anything under `src/lib/sql/`, `src/app/api/sql-report/`,
> or the SQL branches in the generate routes / configurator. It exists so you don't
> have to re-derive the design from the code each time.

## Purpose

Add a **SQL data source** (SQLite-first, via a self-hosted Bun HTTP proxy) to the
report generator so that grouping / totaling / ordering are **offloaded to SQL**
instead of being computed in the browser. The FileMaker (FM) path overloaded the UI
at 100k+ rows because the client did all the work; the SQL path returns small
pre-aggregated payloads (collapsed) and only fetches detail rows on demand.

## Hard constraint — FM path is untouched

Everything here is reached through **additive branches** keyed on a
`data_source_type` discriminator. Legacy FM setups have **no** such key, so
`isSqlSetup()` returns false and they fall through to the unchanged FM engine
(`/api/generate-report`). **Never** modify the FM branch when working here.

The discriminator gate is `isSqlSetup(setup)` in [types.ts](types.ts) — it returns
true iff `setup.data_source_type === "sql"`.

## The AI contract — unchanged

The AI still emits the **existing `ReportConfig` JSON** (`src/lib/reportConfigTypes.ts`).
There is **no LLM-authored SQL**. A deterministic TypeScript builder translates the
`ReportConfig` into parameterized SQL. The only AI difference is the system prompt:
SQL templates use `SQL_REPORTS_SYSTEM_INSTRUCTION`
(`src/constants/sqlReportsSystemInstruction.ts`), which mirrors the FM prompt's output
contract but documents real `GROUP BY` semantics (aggregates run over the **entire**
group in the DB, not just visible rows) and forbids pivot/window analytics in V1.

## Setup JSON shape (the `setup_json` column)

Standardized to mirror the FM setup as closely as possible. **Logical field/table
names equal their physical DB names** — there is no `physical_name` per field and no
`alias` per table (both were removed as redundant; see "Identifier convention").

```jsonc
{
  "data_source_type": "sql",          // discriminator — FM setups omit this
  "connection_type": "sqlite",        // analogous to FM's data_fetching_protocol
  "connection": {
    "host": "https://kiflow.kibizsystems.com/sqlite",
    "apiKey": "123456"
  },
  "tables": {
    "SLI": {                          // logical table key (also the alias seed)
      "physical": "invoice_line_item",// the ONE place logical ≠ physical is allowed
      "fields": {
        "LinePrice": { "type": "number", "label": "Line Price", "prefix": "$" },
        "Quantity":  { "type": "number", "label": "Quantity" },
        "ProductType": { "type": "text", "label": "Product Type" }
      }
    },
    "INV": {
      "physical": "invoice",
      "fields": {
        "InvoiceNo":  { "type": "text", "label": "Invoice No" },
        "InvoiceDate":{ "type": "date", "label": "Invoice Date" }
      }
    }
  },
  "relationships": [
    { "primary_table": "SLI", "joined_table": "INV",
      "source": "InvoiceNo", "target": "InvoiceNo", "join_type": "left" }
  ]
}
```

- `tables[].physical` is the **table name** (logical key may differ, e.g. `SLI` →
  `invoice_line_item`).
- `tables[].fields[].{type,label,prefix,suffix,valuelist}` — same metadata the FM
  viewer/formatters use. The **field key is the physical column name**.
- `connection.host` / `connection.apiKey` live **inside** `connection`.

## Identifier convention (injection-safety foundation)

All identifiers route through [identifiers.ts](identifiers.ts); arbitrary strings can
**never** reach SQL.

- **Field**: `resolveField(setup, table, field)` returns the logical field key as the
  `physicalName` (logical == physical). Unknown field/table → throws.
- **Table alias**: auto-derived as `t_<logicalTableKey>` (e.g. `SLS` → `"t_SLS"`).
  Case is preserved; there is no user-supplied alias.
- **Quoting**: `quoteIdent` wraps in SQLite double-quotes, escaping `"` → `""`.
- **Column ref**: `qualifiedColumn` → `"t_SLS"."InvoiceNo"`.
- **SELECT alias**: `columnAlias(table, field)` → `"SLS.InvoiceNo"` (a single quoted
  token; the dot is inside the quotes). Calc fields → `"calculated.<name>"`.
  Downstream rows are keyed by this `Table.Field` form.

## Architecture & data flow

```
Configurator → /api/templates/[id]/generate(/stream)   [branch on data_source_type]
   ├─ FM  → /api/generate-report                         (UNCHANGED)
   └─ SQL → /api/sql-report/generate
                └─ runSqlReport(sqlReportEngine)
                      ├─ builders (0–4) → { sql, params }
                      ├─ sqlClient.runQuery → Bun server  (POST {host}/query)
                      └─ structureAdapter → { report_structure_json, nested }
```

**Entry/branch points (the only existing files with SQL branches):**
- [generate/route.ts](../../app/api/templates/[template_id]/generate/route.ts):
  `isSql = setupJson.data_source_type === "sql"`. Picks `engineUrl` and, for SQL,
  chooses `view_mode`: `collapsed` when there are group levels, else `expand_all`.
- [generate/stream/route.ts](../../app/api/templates/[template_id]/generate/stream/route.ts):
  same branch; additionally emits a `warn_large` SSE event when the engine returns
  `warn_large`, and forwards `nested_report` (the `NestedReport`) in `done` events.
- [configurator/page.tsx](../../app/[company_slug]/templates/[template_id]/configurator/page.tsx):
  picks `instructionSet` (`SQL_REPORTS_SYSTEM_INSTRUCTION` vs FM) on
  `setup.data_source_type`; dispatches `SET_REPORT_PREVIEW` with `nested_report`.
- [setup/route.ts](../../app/api/company/templates/[template_id]/setup/route.ts) (PUT):
  source-aware validation — SQL requires `connection_type`, `connection.host`,
  `connection.apiKey`, `tables`, `relationships`; FM validation unchanged in the `else`.

## Query generators — 4 builders + 1 shared base CTE

All generators are **pure** `(config, setup, …) → { sql, params }`. Values are always
bound as `?`; identifiers come only from the allow-list. Param order: **base (filter)
params first**, then any group-filter / LIMIT / OFFSET params.

| # | Function (file) | Role | Runs when |
|---|---|---|---|
| 0 | `buildBaseCte` ([baseCte.ts](baseCte.ts)) | `WITH base AS (SELECT <resolved cols> FROM <primary> <JOINs> WHERE <filters/date ranges>)`. The single place that maps logical→physical, builds joins from `db_defination` (ordered by `fetch_order`; `fetch_order===1` is the FROM table), binds filter predicates, and compiles calc fields. | Every query selects `FROM base`. |
| 1 | `buildGroupAggregationQuery(config,setup,level)` ([builders.ts](builders.ts)) | One aggregated row per distinct group value up to `level`: group cols + `MIN(display)` + `COUNT(*) AS "row_count"` + `COALESCE(SUM(total),0)`. SQLite has **no ROLLUP**, so this is called **once per group level**. | collapsed (every load); expand_all/print (headers+totals). |
| 2 | `buildCountQuery(config,setup,groupFilter?)` | `COUNT(*) AS "total_rows" FROM base`, optionally filtered to a group path. Drives the 30k guard. | before drill-down fetch; before expand_all/print. |
| 3 | `buildDetailQuery(config,setup,groupFilter?,limit?,offset?)` | `SELECT * FROM base` ordered by group keys then `body_sort_order`. Replaces FM OR-find + stitch. LIMIT/OFFSET wired but unused in V1. | drill-down (one group); expand_all/print (no filter). |
| 4 | `buildGrandSummaryQuery(config,setup)` | One aggregate row over `summary_fields` (`COALESCE(SUM(col),0)`); falls back to `COUNT(*)` when none. | collapsed and expand_all/print. |

Filter operator semantics in `buildBaseCte` mirror the FM `convertOperator()`:
`A...B`→BETWEEN, `!=`,`>=`,`<=`,`>`,`<`,`==`/`=`→exact, `*`→not-empty,
`""`→empty, otherwise→`LIKE %v%`.

## Formula compiler ([formulaToSql.ts](formulaToSql.ts))

Compiles row-level `custom_calculated_fields` formulas (`=Qty * UnitPrice`,
`=IF(Total>0, Margin/Total, 0)`) → SQLite expressions. tokenize → recursive-descent
parse → emit. Rules:
- Field names must be declared in the calc field's `dependencies` (`Table.Field`) and
  resolve via the allow-list; unknown names throw.
- `IF`→`CASE WHEN … THEN … ELSE … END`; allowed fns: `IF, ABS, ROUND, MIN, MAX`
  (anything else throws).
- `/` and `%` wrap the divisor in `NULLIF(x,0)`; numeric literals inlined (re-serialised
  JS numbers), string literals single-quoted with `'`→`''`. No formula value is a `?`
  param. Aliased `"calculated.<field_name>"`.

## View modes & the engine ([sqlReportEngine.ts](sqlReportEngine.ts))

`runSqlReport({ setup, config, viewMode, groupPath?, confirmLarge? })`:

- **collapsed** — one aggregation query per level + grand summary → returns BOTH a
  FM-shaped `report_structure_json` (Body empty) and a `NestedReport`. No 30k guard
  (aggregates are tiny). Leaves carry `count`+`totals`, no `bodyRows`.
- **drilldown** — `buildCountQuery(groupFilter)`; if `row_count > 30k && !confirmLarge`
  → `{ warn_large:true, row_count }` (no fetch). Else `buildDetailQuery(groupFilter)` →
  `group_rows: DrilldownResult` (label-keyed rows + totals).
- **expand_all** / **print** — global `buildCountQuery`; same 30k guard; else per-level
  aggregation + full detail + grand summary → `buildExpandedNestedReport` distributes
  detail rows into leaf `bodyRows` (label-keyed, SQL order preserved). Returns `nested`
  + the FM scaffold. `print` is identical data to `expand_all`.

`LARGE_ROW_THRESHOLD = 30_000` is exported from [types.ts](types.ts) so the frontend
shows the exact number.

## Structure adapter ([structureAdapter.ts](structureAdapter.ts))

Pure transforms producing **two parallel shapes** so the viewer needs no SQL-specific
renderer:
1. **FM-shaped array** (`buildCollapsedStructure`) — identical layout to FM's
   `generateReportStructure()`: `TitleHeader`, one `Subsummary` per level, `Body`
   (BodyField `[]` for collapsed), `TrailingGrandSummary`. Gives ClassicReportView the
   metadata (column order, prefix/suffix, sort) it already knows how to render.
2. **`NestedReport`** (`buildNestedReport` / `buildNestedGroupTree` /
   `buildExpandedNestedReport`) — typed nested tree: `groups[{field,label,value,count,
   totals,display,totalFields?,children?,bodyRows?}]`, `grandTotals`, `fieldOrder`,
   `fieldPrefix/Suffix`, optional `flatRows` (no-group reports).

Rows from the server may arrive with bare (`SLS.InvoiceNo`) or quoted
(`"SLS.InvoiceNo"`) keys — `getRowValue` / `mapAliasRowToLabels` handle both and map
alias keys → human labels.

## HTTP client & safety ([sqlClient.ts](sqlClient.ts))

- `runQuery(connection, {sql, params})` → `POST {host}/query` with
  `Authorization: Bearer <apiKey>`, 30s timeout (AbortController).
- `assertReadOnly(sql)` strips comments and rejects anything whose first keyword isn't
  `SELECT`/`WITH` (throws `SqlClientError(403)`) **before** sending — defense in depth
  on top of the server's own read-only enforcement.
- `fetchSchema` / `checkHealth` exist for a future schema-discovery phase (not used in
  V1). 401→"check apiKey", 403→"SELECT/WITH only".
- Bun server endpoints: `POST /query {sql,params}` → `{rows,rowCount,columns}`;
  `GET /schema`; `GET /health`.

## Frontend wiring

- **Viewer**: `ClassicReportView` and `DynamicReportPreview` take additive
  `mode:'flat'|'nested'` + `nestedData` (+ `onDrillDown` on Classic). In nested mode
  they read pre-computed `totals`/`count` instead of reducing, and reuse the exact same
  RowSpec/markup/class names so collapse/expand/pagination/print/export are unchanged
  (print stays **pixel-identical** — `renderBodyTableHtml` was extracted; nested skips
  re-sorting since SQL already ordered).
- **`ReportPreview`** detects the nested payload, renders the "See all data" expand-all
  toggle (warn→confirm→refetch), lazily fetches print data, and defines `handleDrillDown`
  (zips `groupPath` with ordered `group_by_fields`, POSTs `view_mode:'drilldown'` with
  `confirm_large`).
- **Setup UI** ([../../components/setup/](../../components/setup/)): `SetupWizard`
  passes `dataSourceType` (derived from `config.data_source_type`) to
  `HostConfigSection` (selects the SQLite logo, shows "Web Server" protocol, SQL host
  placeholder) and `AddDatabaseSection` (shows an **API Key** password field; hides
  FileMaker's file/layout/username/password and the Fetch-Tables flow).

## Constraints & limitations (V1)

- **SQLite dialect only**; `?` positional params. MySQL/Postgres are future work
  (additive behind `connection_type` in `identifiers.ts`/`builders.ts`).
- **No ROLLUP/GROUPING SETS** — N group levels = N aggregation queries.
- **30k preview cap** on detail fetches (drill-down / expand-all / print). Collapsed is
  always allowed.
- **Logical name == physical name** for fields, and `t_<key>` for table aliases. If a
  real DB ever needs `logical ≠ physical` columns, re-introduce a per-field physical
  mapping in `resolveField` (the single choke point) — do **not** scatter it.
- Calc fields must be SQL-compilable (allow-listed fns only); aggregate Excel functions
  are **not** supported here (that's the separate `src/lib/insights` engine).
- LIMIT/OFFSET server-side pagination is wired but unused (UI paginates).
- `apiKey` is stored in plaintext in `setup_json` (secret hardening deferred).

## Technical debt / watch-outs

- The setup **wizard** (`SetupConfig` type) is still FM-shaped (top-level `host`,
  `data_fetching_protocol`), while the SQL **engine** type (`SqlSetup`) stores
  `host` inside `connection` and uses `connection_type`. The wizard currently
  display-adapts via casts (`config as Record<string,unknown>`); the canonical SQL
  `setup_json` is authored/pasted as JSON and saved to the DB. If you make the wizard
  fully author SQL setups, reconcile these two shapes.
- `distributeRowsToLeaves` keys leaves by the NUL-joined group-value path. If two
  sibling groups can share an identical value path this would collide — not possible
  with current `GROUP BY` semantics, but keep in mind if grouping changes.
- Drill-down group-path mapping depends on `group_by_fields` insertion order matching
  the `groupPath` order. Preserve object key order.

## Files

- [types.ts](types.ts) — `SqlSetup`/`SqlFieldDef`/`SqlTableDef`/`SqlConnection`,
  `ViewMode`, `QueryResult`, `isSqlSetup`, `LARGE_ROW_THRESHOLD`.
- [identifiers.ts](identifiers.ts) — quoting + allow-list resolvers (`quoteIdent`,
  `resolveTable`, `resolveField`, `qualifiedColumn`, `columnAlias`).
- [sqlClient.ts](sqlClient.ts) — HTTP client, `assertReadOnly`, `SqlClientError`.
- [baseCte.ts](baseCte.ts) — generator 0 (base CTE: joins, columns, WHERE, calc fields).
- [builders.ts](builders.ts) — generators 1–4.
- [formulaToSql.ts](formulaToSql.ts) — calc-field formula → SQL compiler.
- [structureAdapter.ts](structureAdapter.ts) — rows → FM array + `NestedReport`;
  drill-down + expanded-nested assembly.
- [sqlReportEngine.ts](sqlReportEngine.ts) — `runSqlReport` orchestration (all modes).
- `../../app/api/sql-report/generate/route.ts` — POST endpoint (mirrors FM envelope).
- `../../constants/sqlReportsSystemInstruction.ts` — SQL system prompt.

## Tests

- [__tests__/sql-engine.test.ts](__tests__/sql-engine.test.ts) — pure unit tests
  (identifiers, `assertReadOnly`, all 4 builders, formula compiler, structure adapter,
  client mocking, drilldown + expand_all mocked paths). ~101 pass / 2 skipped.
- [__tests__/sql-live-e2e.test.ts](__tests__/sql-live-e2e.test.ts) — live integration
  against the real Bun server, **guarded by `SQL_LIVE=1`** (skipped otherwise).
  Run: `SQL_LIVE=1 npx vitest run src/lib/sql/__tests__/sql-live-e2e.test.ts`
  (vitest workers may need the sandbox network enabled).

## Live test server

`https://kiflow.kibizsystems.com/sqlite`, apiKey `123456`, read-only. Tables include
`invoice` (~105k) and `invoice_line_item` (~303k). Test template (Supabase):
`79a97510-f595-4a5b-9ff8-83be52de0820` ("SQL Sales Report (SQLite Test)", company
`90f69fd1-f5d6-46e8-b7a9-8b3bf1abd711`, Sales module).
