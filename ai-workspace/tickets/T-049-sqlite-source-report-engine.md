# T-049 — SQLite (SQL) Data Source for the Dynamic Report Generator

**Status:** CODE COMPLETE (Tickets 1–3) — pending manual UI test on the running dev server
**Created:** 2026-06-22
**Owner:** (dev) + Claude Code
**Approved plan:** `~/.claude/plans/i-have-been-wanting-polymorphic-hamming.md` → mirrored to `ai-workspace/plans/P-049-sqlite-source-report-engine.md`

> NOTE: This is a **fresh, independent** ticket. It is NOT a continuation of T-048 /
> P-048 (generic direct-driver SQL engine). T-049 targets the self-hosted **SQLite Bun HTTP
> proxy** and the collapsed / drill-down / expand-all report UX.

## Goal

Add a **SQL data source** (SQLite-first, via the self-hosted Bun HTTP server in
`ai-workspace/docs/sqlite-route.json`) to the report generator so grouping/totaling/pagination are
**offloaded to SQL**. The existing **FileMaker path must remain unchanged** — all SQL behavior is
reached through additive branches keyed on a `data_source_type` discriminator.

## Scope (phased)

- **Ticket 1 (this pass):** end-to-end **collapsed** view — paste a SQL `setup_json`, AI emits the
  existing `ReportConfig`, a deterministic TS SQL builder produces parameterized queries, and the
  collapsed report (group/subgroup headers + SQL-computed totals + grand total) renders.
- **Ticket 2:** single-group **drill-down** (count → warn if >30k → fetch one group) + nested-JSON
  support in `ClassicReportView`.
- **Ticket 3:** **expand-all / print** (full nested JSON, 30k guard, pixel-identical print view).

## Out of scope (now)

`GET /schema` auto-discovery + schema-proxy route; manual field-picker UI buttons; MySQL/PostgreSQL
dialects; server-side pagination; `apiKey` secret hardening.

## Confirmed decisions

1. AI → existing `ReportConfig` JSON → **deterministic TS SQL builder** (no LLM-authored SQL).
2. Setup created by **pasting a full `setup_json`** with embedded tables/fields/labels (mirrors FM).
3. **Phased** delivery with a STOP/review at each ticket boundary.

## Acceptance (Ticket 1)

- Saving a SQL `setup_json` passes the source-aware setup validation; FM setups still validate as before.
- `POST /api/sql-report/generate` (collapsed) returns a viewer-compatible structure from the live
  Bun server.
- An existing FileMaker template still generates identical output (regression).
- `npm run build`, `npm run lint`, and Ticket 1 Vitest/API tests pass.

## Subagent execution

12 subagents (SA-1…SA-12), 4 Opus / 8 Sonnet — see P-049 for the full table, dependencies, and
model rationale.
