# P-049 — SQLite (SQL) Data Source for the Dynamic Report Generator

> Mirror of the approved plan at `~/.claude/plans/i-have-been-wanting-polymorphic-hamming.md`.
> Fresh ticket — independent of T-048/P-048.

## Context

KiBiAI today generates reports **only** from FileMaker. The AI turns a setup schema + user prompt
into a `ReportConfig` JSON; TS code multi-fetches from FileMaker (parent → extract relationship
keys → OR-FIND on related tables → `stitch()` into flat rows), then `generateReportStructure()`
emits a **flat** JSON array. The UI (`ClassicReportView`, `DynamicReportPreview`) does **all**
grouping/totaling/pagination in the browser; 100k+ rows freeze it.

Add a **SQL data source** (SQLite Bun HTTP server first) that **offloads grouping/totaling to SQL**:
collapsed default view, single-group drill-down (count → warn >30k → fetch), and expand-all/print
as a nested JSON the UI just renders. **FileMaker path stays byte-for-byte unchanged** via additive
branches keyed on a `data_source_type` discriminator.

**Confirmed decisions:** (1) AI emits existing `ReportConfig`; deterministic TS SQL builder makes
parameterized SQL. (2) Paste a full `setup_json` with embedded tables/fields. (3) Phased: collapsed
first, then drill-down, then expand-all/print.

## SQL source API

Bun server, `Authorization: Bearer <apiKey>`, **SELECT/WITH only** (else 403).
`POST {baseUrl}/query` `{sql, params}` → `{rows, rowCount, columns}`; `GET /schema`; `GET /health`.

## SQL generators — 4 + 1 shared base-CTE helper (pure `(config, setup) → {sql, params}`)

Values bound as `?`; identifiers resolved only via setup allow-list, dialect-quoted (`"x"`, `"`→`""`).

| # | Generator | Responsibility | When |
|---|---|---|---|
| 0 | `buildBaseCte` (helper) | `WITH base AS (SELECT resolved cols FROM …JOINs (db_defination)… WHERE …filters/date ranges…)`; maps logical→physical, builds INNER/LEFT joins, binds filters, compiles row-level calc fields | every query selects `FROM base` |
| 1 | `buildGroupAggregationQuery(config, setup, level)` | group field(s) + display + `COUNT(*)` + `SUM(totals)`; **once per level** (SQLite has no ROLLUP) | collapsed; expand-all headers/totals |
| 2 | `buildCountQuery(config, setup, groupFilter?)` | `COUNT(*)` over base, optionally group-filtered; drives 30k warning | before drill-down / expand-all |
| 3 | `buildDetailQuery(config, setup, groupFilter?, limit?, offset?)` | flat body rows via JOINs, ordered by group keys + `body_sort_order`; replaces FM OR-find+stitch; limit/offset wired-unused in V1 | drill-down / expand-all |
| 4 | `buildGrandSummaryQuery(config, setup)` | one aggregate row over `summary_fields` | collapsed + expand-all |

`group_by_fields` becomes a **real SQL GROUP BY** over the entire group (documented in the SQL
system instruction; no schema change).

## SQL setup_json shape (discriminated)

```jsonc
{
  "data_source_type": "sql",            // FM setups omit this → treated as "filemaker"
  "sql_dialect": "sqlite",
  "connection": { "baseUrl": "https://kiflow.kibizsystems.com/sqlite", "apiKey": "123456" },
  "tables": { "SLS": { "physical": "sales_orders", "alias": "t1",
      "fields": { "InvoiceNo": { "physical_name": "invoice_no", "type": "text", "label": "Invoice No" },
                  "LinePrice": { "physical_name": "line_price", "type": "number", "label": "Line Price", "prefix": "$" } } } },
  "relationships": [ { "primary_table": "SLS", "joined_table": "REG", "source": "RegionID", "target": "RegionID", "join_type": "left" } ]
}
```

## Architecture / branch points (FM untouched — only 3 existing files edited)

```
Page → /api/templates/[id]/generate(/stream) → branch on data_source_type
        ├─ "filemaker" → /api/generate-report           (UNCHANGED)
        └─ "sql"       → /api/sql-report/generate (NEW)  → sqlReportEngine → sqlClient → structureAdapter
```

1. `templates/[id]/generate/route.ts` + `.../generate/stream/route.ts` — pick engine URL and AI
   instruction (`SQL_REPORTS_SYSTEM_INSTRUCTION` vs `REPORTS_SYSTEM_INSTRUCTION`) by source type.
2. `company/templates/[id]/setup/route.ts` PUT — source-aware validation (`sql` branch vs existing
   FM branch unchanged).

**New files:** `src/lib/sql/{types,sqlClient,identifiers,baseCte,builders,formulaToSql,structureAdapter,sqlReportEngine}.ts`,
`src/app/api/sql-report/generate/route.ts`, `src/constants/sqlReportsSystemInstruction.ts`.
`ReportConfig` reused unchanged; add `SqlSetup` types alongside.

## Report viewer — nested JSON (Tickets 2–3)

Normalize the nested SQL shape into the structures the renderers already consume; gate with
`mode: 'flat' | 'nested'` (flat = FM, reached via unchanged `else`). Nested contract = single
top-level object `{ mode, title, fieldOrder, fieldPrefix, fieldSuffix, groups:[{field,label,count,
totals,totalFields,display,children|bodyRows}], grandTotals,… }`. Collapsed payload omits
`bodyRows`; expand-all includes them. `ClassicReportView` gets `mode`/`nestedData`/`onDrillDown`
(async drill with 30k confirm, reuse DrillModal); `DynamicReportPreview` branches in
`generateDynamicReport`, reusing markup/CSS for pixel-identical print; `ReportPreview` detects the
nested object and wires the drill callback.

## Phased delivery

- **T1:** collapsed end-to-end (generators 1 & 4 + count live).
- **T2:** drill-down (generators 2 & 3) + classic nested viewer.
- **T3:** expand-all + print (1+3+4) with 30k guard.
- **Later/OOS:** `/schema` auto-discovery, field-picker UI, MySQL/Postgres dialects, server-side
  pagination, apiKey hardening.

## Verification

Vitest builder snapshots (each generator + calc-field→SQL; identifier quoting; reject unknown
fields; never inline values); `sqlClient` SELECT-only guard + 401/403 mapping; `test:api` collapsed
against live Bun server (`sqlite-route.json`, apiKey `123456`); FM regression (identical output,
setup PUT still accepts FM / rejects malformed); manual configurator run; `npm run build` + `lint`.

## Implementation via Subagents

12 subagents; each owns distinct files; STOP at each ticket boundary. **Opus** for hardest /
highest-blast-radius work; **Sonnet** for well-specified construction.

### Ticket 1
| ID | Subagent | Files | Depends | Model |
|----|----------|-------|---------|-------|
| SA-1 | SQL Core & Client | `src/lib/sql/{types,sqlClient,identifiers}.ts` | — | Sonnet |
| SA-2 | SQL System Instruction | `src/constants/sqlReportsSystemInstruction.ts` | — | Opus |
| SA-3 | Builders & Formula compiler | `src/lib/sql/{baseCte,builders,formulaToSql}.ts` | SA-1 | Opus |
| SA-4 | Structure Adapter & Engine (collapsed) | `src/lib/sql/{structureAdapter,sqlReportEngine}.ts` | SA-1,3 | Sonnet |
| SA-5 | API route + branch wiring (solo) | NEW `api/sql-report/generate/route.ts`; EDIT 2 generate routes + setup PUT | SA-2,4 | Sonnet |
| SA-6 | Tests + FM regression | Vitest/API + regression | SA-5 | Sonnet |

### Ticket 2
| SA-7 | Drill-down engine/route | gen 2&3, `view_mode:'drilldown'`, count→warn | T1 | Sonnet |
| SA-8 | ClassicReportView nested mode | EDIT `ClassicReportView.tsx` | SA-7 | Opus |
| SA-9 | ReportPreview wiring + drill callback | EDIT `ReportPreview.tsx` (+ ctx) | SA-8 | Sonnet |

### Ticket 3
| SA-10 | Nested JSON full assembly | engine 1+3+4 + 30k guard | T2 | Sonnet |
| SA-11 | DynamicReportPreview nested print | EDIT `DynamicReportPreview.tsx` | SA-10 | Opus |
| SA-12 | Expand-all toggle + tests | EDIT `ReportPreview.tsx` + tests | SA-11 | Sonnet |

**Order:** Wave A `SA-1 ∥ SA-2` → `SA-3` → `SA-4` → `SA-5 (solo)` → `SA-6` → **STOP**; then T2; then T3.
