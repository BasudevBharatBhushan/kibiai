# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest unit/integration tests
npm run test:api     # API tests via Vitest + Supertest
npm run test:e2e     # Playwright end-to-end tests
```

## Knowledge Graph — Use Graphify First

This project has a live knowledge graph in `graphify-out/graph.json` served via the `graphify` MCP server (7 tools available). **Always query the graph before reading files or grepping**, unless you already know the exact location.

### When to use graphify tools

| Situation | Tool to call |
|-----------|-------------|
| Finding which files/functions relate to a feature | `query_graph` with a keyword (BFS/DFS over nodes) |
| Looking up a specific function, component, or module | `get_node` by label |
| Understanding what a function calls / what calls it | `get_neighbors` |
| Exploring all code in a subsystem (SQL engine, report gen, etc.) | `get_community` with the community ID |
| Identifying the most critical shared abstractions | `god_nodes` |
| Tracing how two concepts are connected | `shortest_path` |
| Quick orientation — node/edge/community counts | `graph_stats` |

### Protocol

1. **Before any exploration task** (finding relevant files, understanding a subsystem, impact analysis) — call `query_graph` or `get_node` first. Use the returned file paths and node IDs to target your `Read`/`Grep` calls instead of broad directory scans.
2. **Before writing or editing** — call `get_neighbors` on the function/component you're about to touch to understand its callers and dependencies. This prevents unintended breakage.
3. **For cross-cutting changes** (renaming, refactoring, interface changes) — call `shortest_path` between the entry point and affected leaf nodes to map the full call chain before touching anything.
4. **Never skip the graph for "quick" lookups** — a `query_graph` call takes milliseconds and often surfaces non-obvious relationships that Grep misses (e.g., semantic edges between doc concepts and code).

### Graph stats (as of last build)
- **883 nodes, 1170 edges, 137 communities**
- Top god nodes: `POST()`, `GET()`, `buildBaseCte()`, `SQL Report Engine Module`, `executeV3InsightPlan()`
- Visualization: `graphify-out/graph.html` (open in browser for interactive exploration)
- Report: `graphify-out/GRAPH_REPORT.md`

---

## Mandatory Workflow — Read Before Implementing

Every change must follow this sequence (defined in `.agents/workflows/workflow.md`):

1. **Ticket** — create `ai-workspace/tickets/T-XXX-<task>.md`
2. **Plan** — create `ai-workspace/plans/P-XXX-<task>.md`
3. **STOP** — wait for explicit developer approval (`"Proceed"` / `"Approved"`)
4. Implement incrementally, logging each step to `ai-workspace/execution-logs/L-XXX-<task>.md`
5. Create test definition at `ai-workspace/tests/TEST-XXX-<task>.md`, then run tests
6. Mark ticket `COMPLETED` and update docs

Max 2 active tickets at a time (`ai-workspace/active-ticket`).

**Before starting any feature or component, read:**
- `ai-workspace/docs/frontend-structure.md`
- `ai-workspace/docs/backend-structure.md`
- `ai-workspace/docs/coding-guidelines.md`

## Architecture Overview

KiBiAI is an AI-driven business insight engine — a multi-tenant Next.js 16 (App Router) full-stack application. It generates reports and charts via OpenAI, integrates with FileMaker as a legacy data source, and supports MySQL/PostgreSQL/SQLite as customer data sources, all on top of a Supabase (PostgreSQL) primary database.

### Multi-Tenancy

Production uses **subdomain-based routing** (`middleware.ts`):

| Subdomain | Route | Audience |
|---|---|---|
| `admin.kibiai.itsb3.xyz` | `/admin` | Platform admins |
| `<slug>.kibiai.itsb3.xyz` | `/[company_slug]` | Company users |

Local dev uses **path-based routing**: `localhost:3000/admin`, `localhost:3000/[company_slug]`.

Company slugs are validated against the `allowed_subdomains` table via `/api/subdomains/validate`.

### Layer Architecture

```
Page / API Route → Service → Data Layer (DB / ORM)
```

- **API routes** (`src/app/api/`): handle request/response, validate via Zod, call services only
- **Services** (`src/services/`): business logic, reusable across routes
- **Data layer** (`src/lib/`): DB queries, no business rules

### Key Subsystems

- **Report generation** — OpenAI-powered, templates in `src/constants/reportsSystemInstruction.ts`
- **Chart builder** — Highcharts, system prompts in `src/constants/chartsSystemInstruction.ts`
- **Pivot tables** — WebDataRocks integration (`src/lib/pivot/`)
- **SQL adapters** — MySQL, PostgreSQL, SQLite in `src/lib/sql/`
- **FileMaker integration** — `src/lib/utils/filemaker.ts`
- **Chatbot** — conversational AI via `ChatbotContext`

### State Management

Global state via React Context providers (in `src/context/`): `AccessControlContext`, `DashboardContext`, `ReportContext`, `ChatbotContext`. Always wrap context-provided functions in `useCallback` to prevent `useEffect` dependency loops.

### API Client

All frontend API calls must use `src/lib/utils/apiClient.ts` (auto-scopes `companyId`). Never use raw `fetch` directly. Standard response shape: `{ success: boolean, data?: any, error?: string }`.

## Coding Rules

- **No `any`** — always use explicit TypeScript types/interfaces
- **Server Components by default** — add `'use client'` only for interactivity or browser APIs
- **`cn()` for class merging** — use `clsx` + `tailwind-merge` via the `cn` helper
- **API error handling** — always check `response.ok` and `Content-Type` before `.json()`; wrap route handlers in `try/catch` returning `NextResponse.json` with status codes
- **Skeleton loaders** — every async component must implement an `isLoading` skeleton state
- **Branch naming** — `feature/T-XXX-name` or `fix/T-XXX-name`

## Database Safety

Never mutate the production database directly. For schema changes:
1. Write a migration SQL file
2. Store it in `ai-workspace/sql/` (e.g., `001_add_user_role.sql`)
3. Ask the developer to execute it manually
4. Update `ai-workspace/docs/db-architecture.md`

## agents.md Files

Every major module must have an `agents.md` documenting its architecture, execution flow, dependencies, limitations, and technical debt. Check for the nearest `agents.md` before editing a module, and update it if the architecture changes.
