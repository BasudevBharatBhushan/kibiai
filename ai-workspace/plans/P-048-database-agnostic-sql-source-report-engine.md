# P-048 - Database-Agnostic SQL Source Report Engine
## Any SQL Database as Source, Supabase as KiBiAI Control Plane

- **Ticket**: T-048
- **Scope**: fullstack, backend-heavy
- **Status**: Draft, awaiting approval before implementation
- **Created**: 2026-06-03
- **Related Documents**:
  - `ai-workspace/plans/PostgreSQL-Migration-Proposal.md`
  - `ai-workspace/plans/P-047-scalable-report-engine-migration.md`
  - `ai-workspace/docs/backend-structure.md`
  - `ai-workspace/docs/frontend-structure.md`
  - `ai-workspace/docs/db-architecture.md`
  - `ai-workspace/docs/misc/reports-system-instruction.txt`

---

## 1. Executive Summary

The PostgreSQL proposal correctly identifies the main bottleneck: KiBiAI currently fetches operational data through FileMaker APIs, joins and aggregates records in Node.js memory, and sends large report datasets to the browser. That architecture cannot scale reliably for 50k+ rows.

However, the target architecture should not be "PostgreSQL only." KiBiAI should support any approved SQL source database through a database-agnostic source layer:

```text
KiBiAI application database:
  Supabase/PostgreSQL remains the control plane
  - companies
  - users
  - modules
  - report_template_setups
  - report_templates
  - reports
  - chart_templates
  - charts
  - permissions
  - audit metadata

Customer/source databases:
  Read-only data plane
  - PostgreSQL
  - MySQL / MariaDB
  - SQL Server
  - future SQL dialects through adapters
```

The core design is:

1. Store source connection metadata separately from template JSON.
2. Store credentials only through a secret reference, never plaintext JSONB.
3. Introspect source schemas into a normalized KiBiAI schema cache.
4. Keep `ReportConfigJSON` as the semantic report definition.
5. Translate report config into a provider-neutral `QuerySpec`.
6. Compile `QuerySpec` into safe parameterized SQL per provider.
7. Execute pagination, joins, filters, summaries, and supported calculated fields in the source database.
8. Persist saved report snapshots in paginated KiBiAI result rows when immutability is required.

This avoids hardcoding PostgreSQL as the reporting source while still preserving the performance goals of the PostgreSQL migration proposal.

---

## 2. Current Application Understanding

### 2.1 Framework and Control Database

The application is a Next.js App Router application under `src/`.

Important current patterns:

- API routes live in `src/app/api`.
- Frontend workspace pages live under `src/app/[company_slug]`.
- Shared setup UI lives under `src/components/setup`.
- Supabase/PostgreSQL is already the KiBiAI application database.
- Server APIs use `createAdminClient()` for service-role Supabase access.
- Company data must be scoped through `company_id`.
- Frontend APIs should use `src/utils/apiClient.ts`.

### 2.2 Current Setup Model

The setup wizard currently uses this shape from `src/components/setup/types.ts`:

```typescript
export interface SetupConfig {
  host: string;
  data_fetching_protocol: "data-api" | "o-data-api";
  tables: Record<string, TableConfig>;
  relationships: Relationship[];
}
```

Each table stores FileMaker-oriented connection details:

```typescript
export interface TableConfig {
  file: string;
  username: string;
  password: string;
  layout: string | null;
  fields: Record<string, FieldConfig>;
}
```

Implication:

- Credentials are currently embedded in setup JSON.
- The setup model assumes FileMaker host/protocol/file/layout semantics.
- PostgreSQL is shown in the setup UI as "support coming soon", but the type model cannot represent SQL providers safely yet.

### 2.3 Current Metadata and Template Storage

The app stores report setup/config in Supabase JSONB columns:

- `report_templates.report_template_setup_json`
- `report_templates.report_template_config_json`
- `report_templates.report_template_data_json`
- `report_template_setups.setup_json`

The reusable setup library can link templates through `setup_id`; if a local template setup is empty, generation falls back to the reusable setup.

This pattern should be preserved, but `setup_json` must become a versioned source schema reference instead of a plaintext connection blob.

### 2.4 Current Report Generation Flow

Current flow:

```text
src/app/[company_slug]/templates/[template_id]/generate/page.tsx
  -> POST /api/templates/[template_id]/generate/stream
     -> POST /api/generate-report
        -> fetchDataFromAPI()
        -> processFetchOrder()
        -> stitch()
        -> generateReportStructure()
     -> save preview/version/report rows in Supabase JSONB
```

Key files:

| File | Current Role |
|---|---|
| `src/app/api/generate-report/route.ts` | Core FileMaker-oriented engine. Validates setup/config, fetches data, stitches in memory, builds Classic report JSON. |
| `src/lib/utils/utility.ts` | FileMaker Data API and OData helper functions, including `fetchFmRecord()`. |
| `src/app/api/templates/[template_id]/generate/stream/route.ts` | Authenticates, resolves template/setup, calls `/api/generate-report`, emits SSE logs, persists output. |
| `src/app/[company_slug]/templates/[template_id]/generate/page.tsx` | Generate UI, runtime filters, SSE stream consumer. |
| `src/components/DynamicReportPreview.tsx` and `src/components/report-viewer/ClassicReportView.tsx` | Report rendering surfaces. |
| `src/components/setup/*` | Source setup wizard, field mapping, relationships, setup library. |

### 2.5 Current Engine Bottlenecks

`src/app/api/generate-report/route.ts` currently:

- Holds all fetched datasets inside `InMemoryDataManager`.
- Fetches source tables through FileMaker API helpers.
- Extracts join keys from prior datasets.
- Performs in-memory nested-loop joins inside `stitch()`.
- Converts joined rows into label-keyed `BodyField` arrays.
- Applies calculated fields in JavaScript/HyperFormula.
- Returns `report_structure_json` plus `stitch_result`.

Problems:

- Joins are CPU and memory heavy in Node.
- Source pagination is not a true database-level page model.
- Browser receives too much data.
- Saved reports can store huge JSON arrays.
- The code is tied to FileMaker protocols rather than a general source abstraction.

### 2.6 Graphify Discovery Status

Project rules requested Graphify MCP discovery. The active tool list did not expose:

- `mcp_graphify_graph_stats`
- `mcp_graphify_query_graph`
- `mcp_graphify_get_node`
- `mcp_graphify_shortest_path`

`tool_search` returned no Graphify MCP tools. This plan therefore uses the rule-approved fallback: targeted file reads and `rg` searches rather than broad recursive reading.

Fallback dependency map:

```text
Setup UI
  src/components/setup/types.ts
  src/components/setup/SetupWizard.tsx
  src/components/setup/HostConfigSection.tsx
  src/components/setup/AddDatabaseSection.tsx
  src/components/setup/TableCard.tsx
  src/components/setup/RelationshipsPanel.tsx

Setup APIs
  src/app/api/company/templates/[template_id]/setup/route.ts
  src/app/api/company/setups/route.ts
  src/services/setup.service.ts
  src/app/api/filemaker/setup/layouts/route.ts
  src/app/api/filemaker/setup/fields/route.ts

Report generation
  src/app/api/templates/[template_id]/generate/stream/route.ts
  src/app/api/templates/[template_id]/generate/route.ts
  src/app/api/generate-report/route.ts
  src/lib/utils/utility.ts

Rendering and downstream consumers
  src/app/[company_slug]/templates/[template_id]/generate/page.tsx
  src/components/DynamicReportPreview.tsx
  src/components/report-viewer/ClassicReportView.tsx
  src/lib/charts/*
  src/lib/insights/*
```

---

## 3. Target Architecture

### 3.1 Architectural Decision

Use a source adapter architecture, not a PostgreSQL-only mirror architecture.

```text
Browser
  -> Generate / Preview UI
     -> KiBiAI API Route
        -> ReportEngineFacade
           -> SourceConnectionResolver
           -> SchemaCache / Setup Resolver
           -> ReportConfigValidator
           -> QuerySpecBuilder
           -> DialectCompiler
           -> SqlSourceAdapter
              -> Customer SQL Database
           -> SnapshotWriter, when saving immutable reports
              -> Supabase report_result_rows
```

### 3.2 Control Plane vs Data Plane

Control plane:

- Supabase/PostgreSQL owned by KiBiAI.
- Stores tenant metadata, templates, setup schemas, saved report metadata, chart templates, permissions, and audit logs.
- Enforces company-level isolation.
- Stores only source connection references and schema metadata, not plaintext credentials.

Data plane:

- Customer SQL database.
- Queried read-only from server-side API routes or worker jobs.
- Performs joins, filters, aggregation, sorting, and pagination.
- Does not receive KiBiAI tenant metadata except what is necessary to connect/query.

### 3.3 Source Modes

V1 should support two modes.

#### Mode A: Direct SQL Source Query

Used when the customer SQL database is reachable from KiBiAI runtime.

Behavior:

- Setup wizard introspects source schema.
- Report generation compiles source SQL.
- Source DB returns page rows and summaries.
- Saved report snapshots are materialized to KiBiAI if immutability is required.

This is the default mode for SQL sources.

#### Mode B: SQL Warehouse / Mirror Source

Used when:

- Customer database is not reachable directly.
- Customer does not want production BI queries on the operational database.
- Large analytical workloads need a warehouse.
- Change data capture or scheduled sync is required.

Behavior:

- External sync pipeline mirrors data into a SQL warehouse.
- KiBiAI treats the warehouse as another SQL source.
- This preserves the adapter architecture because the warehouse is still just a SQL source.

This mode includes the original PostgreSQL proposal as one possible deployment pattern, not the only target architecture.

### 3.4 Legacy FileMaker Support

FileMaker remains a legacy source type during migration:

```typescript
type SourceKind = "filemaker" | "sql";
```

The existing FileMaker engine should not be removed in the first implementation. Instead:

- Existing setup JSON continues to route to the legacy FileMaker path.
- New SQL setup JSON routes to the SQL engine.
- A later migration can convert FileMaker clients to a SQL mirror or connector.

---

## 4. Core Requirements

### 4.1 Functional Requirements

The SQL source engine must support:

- Multiple SQL providers through adapters.
- Connection test from setup UI.
- Schema introspection.
- Table and column selection.
- Field labels, formats, prefixes, suffixes, and value lists.
- Relationship builder for join definitions.
- Existing `ReportConfigJSON` concepts:
  - `db_defination`
  - `date_range_fields`
  - `filters`
  - `group_by_fields`
  - `report_columns`
  - `body_sort_order`
  - `summary_fields`
  - `custom_calculated_fields`
  - `report_header`
- Runtime filters from the generate screen.
- Database-level pagination.
- Database-level count.
- Database-level grand summaries.
- Database-level group summaries.
- Immutable saved reports by default.
- Backward-compatible rendering of old JSONB report snapshots.

### 4.2 Non-Functional Requirements

The SQL source engine must:

- Avoid raw SQL input from users.
- Parameterize all values.
- Allowlist all identifiers from setup/schema cache.
- Never execute write statements against source databases.
- Use read-only transactions or read-only credentials when possible.
- Enforce query timeout and row/page limits.
- Avoid loading full datasets into Node.js memory for normal viewing.
- Avoid sending full datasets to the browser.
- Produce provider-neutral error messages safe for users.
- Log provider, template, query hash, row count, duration, and failure reason.
- Keep secrets out of logs.

### 4.3 V1 Provider Scope

Recommended V1 providers:

| Provider | Priority | Notes |
|---|---:|---|
| PostgreSQL | P0 | Covers Supabase and standard PostgreSQL sources. |
| MySQL / MariaDB | P0 | Common operational source database. |
| SQL Server | P0 | Common ERP and enterprise source database. |
| SQLite | P1 | Useful for local files or embedded datasets, but serverless file handling needs a separate decision. |
| Oracle | P2 | Add later through the adapter contract. |
| Snowflake / BigQuery | P2 | SQL-like warehouses with different drivers/auth and billing concerns. |

---

## 5. Data Model Changes

All DDL belongs in `ai-workspace/sql` during implementation, then `ai-workspace/docs/db-architecture.md` must be updated.

### 5.1 New Table: `source_connections`

Purpose:

- Stores non-secret connection metadata.
- One connection can be reused by many setup templates.
- Scoped by `company_id`.

Proposed DDL:

```sql
CREATE TABLE source_connections (
  connection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  module_id UUID NULL REFERENCES modules(module_id) ON DELETE SET NULL,

  display_name VARCHAR(180) NOT NULL,
  provider VARCHAR(40) NOT NULL,
  source_kind VARCHAR(30) NOT NULL DEFAULT 'sql',

  host TEXT NULL,
  port INTEGER NULL,
  database_name TEXT NULL,
  default_schema TEXT NULL,

  auth_method VARCHAR(40) NOT NULL DEFAULT 'password',
  username_hint TEXT NULL,
  secret_ref TEXT NOT NULL,

  ssl_mode VARCHAR(40) NULL,
  connection_options_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  status VARCHAR(30) NOT NULL DEFAULT 'untested',
  last_tested_at TIMESTAMPTZ NULL,
  last_test_result_json JSONB NULL,

  created_by_user_id UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
  created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_on TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT source_connections_provider_check
    CHECK (provider IN ('postgres', 'mysql', 'mariadb', 'sqlserver', 'sqlite', 'oracle', 'snowflake', 'bigquery')),

  CONSTRAINT source_connections_kind_check
    CHECK (source_kind IN ('sql', 'filemaker', 'warehouse'))
);

CREATE INDEX idx_source_connections_company
  ON source_connections(company_id);

CREATE INDEX idx_source_connections_company_provider
  ON source_connections(company_id, provider);
```

Important:

- `secret_ref` is a pointer, not a secret.
- `username_hint` can store non-sensitive display text such as `report_reader`, but not passwords or full connection strings.
- `connection_options_json` can store non-secret options such as SSL requirement, read-only flag, schema include/exclude patterns, and tunnel settings.

### 5.2 Secret Storage Options

Preferred production option:

```text
source_connections.secret_ref -> Supabase Vault secret id
```

Alternative if Supabase Vault is not available:

```sql
CREATE TABLE source_connection_secrets (
  secret_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  encrypted_payload BYTEA NOT NULL,
  encryption_key_version TEXT NOT NULL,
  created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_on TIMESTAMPTZ NULL
);
```

Rules:

- Only server-side service code can read/decrypt secrets.
- Never return secret payloads to the browser.
- Never persist secrets inside `report_template_setup_json`.
- Never log secrets, connection strings, or Authorization headers.
- Support rotation by updating secret payload and `updated_on`.

### 5.3 New Table: `source_schema_cache`

Purpose:

- Caches introspected schemas, tables, columns, and basic constraints.
- Keeps AI prompts and setup UI fast.
- Gives the query builder an allowlist of valid identifiers.

Proposed DDL:

```sql
CREATE TABLE source_schema_cache (
  schema_cache_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES source_connections(connection_id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,

  catalog_name TEXT NULL,
  schema_name TEXT NULL,
  table_name TEXT NOT NULL,
  table_type TEXT NULL,
  column_name TEXT NOT NULL,
  ordinal_position INTEGER NULL,

  source_data_type TEXT NOT NULL,
  normalized_type VARCHAR(30) NOT NULL,
  is_nullable BOOLEAN NULL,
  is_primary_key BOOLEAN NOT NULL DEFAULT false,
  is_indexed BOOLEAN NOT NULL DEFAULT false,

  numeric_precision INTEGER NULL,
  numeric_scale INTEGER NULL,
  max_length INTEGER NULL,
  datetime_precision INTEGER NULL,

  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  discovered_on TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (connection_id, catalog_name, schema_name, table_name, column_name)
);

CREATE INDEX idx_source_schema_cache_connection
  ON source_schema_cache(connection_id);

CREATE INDEX idx_source_schema_cache_table
  ON source_schema_cache(connection_id, schema_name, table_name);
```

Normalized type values:

```text
text
number
integer
decimal
boolean
date
datetime
time
json
binary
unknown
```

### 5.4 New Table: `report_query_runs`

Purpose:

- Tracks execution metadata for previews and saved report runs.
- Supports audit, performance monitoring, failures, and rollback.

Proposed DDL:

```sql
CREATE TABLE report_query_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  report_template_id UUID NOT NULL REFERENCES report_templates(report_template_id) ON DELETE CASCADE,
  report_id UUID NULL REFERENCES reports(report_id) ON DELETE CASCADE,
  connection_id UUID NULL REFERENCES source_connections(connection_id) ON DELETE SET NULL,

  run_mode VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',

  query_hash TEXT NOT NULL,
  query_spec_json JSONB NOT NULL,
  compiled_sql_redacted TEXT NULL,
  parameters_redacted_json JSONB NULL,

  total_rows INTEGER NULL,
  page_size INTEGER NULL,
  summary_json JSONB NULL,
  error_message TEXT NULL,

  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  duration_ms INTEGER NULL,

  created_by_user_id UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
  created_on TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT report_query_runs_mode_check
    CHECK (run_mode IN ('preview', 'template_update', 'saved_report', 'chart', 'insight')),

  CONSTRAINT report_query_runs_status_check
    CHECK (status IN ('queued', 'running', 'ready', 'failed', 'cancelled'))
);

CREATE INDEX idx_report_query_runs_template
  ON report_query_runs(report_template_id, created_on DESC);

CREATE INDEX idx_report_query_runs_report
  ON report_query_runs(report_id);
```

### 5.5 New Table: `report_result_rows`

Purpose:

- Stores saved report snapshots in pages/rows, keyed by `report_id` and `run_id`.
- Keeps `reports.report_data_json` small.
- Supports immutable report history and charts built from saved reports.

Proposed DDL:

```sql
CREATE TABLE report_result_rows (
  result_row_id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES report_query_runs(run_id) ON DELETE CASCADE,

  row_index INTEGER NOT NULL,
  row_data JSONB NOT NULL,

  created_on TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (report_id, row_index)
);

CREATE INDEX idx_report_result_rows_report_page
  ON report_result_rows(report_id, row_index);

CREATE INDEX idx_report_result_rows_run
  ON report_result_rows(run_id);

CREATE INDEX idx_report_result_rows_data_gin
  ON report_result_rows USING GIN (row_data);
```

Row format:

```json
{
  "SLS.InvoiceNo": "INV-1001",
  "SLS.SalesDate": "2026-01-10",
  "LIC.LinePrice": 250.00,
  "calculated.LineTotal": 250.00
}
```

Rules:

- Store machine keys, not labels.
- Key format is `logicalTable.fieldName`, not physical database names.
- Labels resolve at render time from setup JSON.
- This allows old labels to be preserved per report snapshot if setup/config metadata is stored with the report.

### 5.6 Modified Existing Tables

No immediate DDL is required for `report_templates` or `report_template_setups` because setup/config are JSONB already.

Recommended optional additions:

```sql
ALTER TABLE report_template_setups
  ADD COLUMN source_connection_id UUID NULL REFERENCES source_connections(connection_id) ON DELETE SET NULL,
  ADD COLUMN setup_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE report_templates
  ADD COLUMN source_connection_id UUID NULL REFERENCES source_connections(connection_id) ON DELETE SET NULL;
```

Reason:

- Makes filtering and admin reporting easier.
- Avoids scanning JSONB to find connection usage.
- Keeps the source reference explicit.

---

## 6. Versioned Setup JSON

### 6.1 Current V1 Setup JSON

Current setup is FileMaker-oriented:

```json
{
  "host": "fm.example.com",
  "data_fetching_protocol": "data-api",
  "tables": {
    "SLS": {
      "file": "KIB__Web",
      "username": "user",
      "password": "secret",
      "layout": "Sales",
      "fields": {}
    }
  },
  "relationships": []
}
```

### 6.2 Proposed V2 Setup JSON

V2 separates source connection, logical schema, physical schema, and display metadata.

```json
{
  "version": 2,
  "source": {
    "kind": "sql",
    "provider": "postgres",
    "connection_id": "uuid",
    "schema_cache_version": "2026-06-03T10:00:00.000Z"
  },
  "tables": {
    "SLS": {
      "logical_name": "SLS",
      "display_name": "Sales",
      "physical": {
        "catalog": null,
        "schema": "public",
        "table": "sales_orders"
      },
      "alias": "sls",
      "fields": {
        "InvoiceNo": {
          "physical_name": "invoice_no",
          "type": "text",
          "source_data_type": "varchar",
          "label": "Invoice No",
          "prefix": "",
          "suffix": "",
          "nullable": false,
          "is_primary_key": false,
          "is_indexed": true
        },
        "SalesDate": {
          "physical_name": "sales_date",
          "type": "date",
          "source_data_type": "date",
          "label": "Sales Date"
        }
      }
    },
    "LIC": {
      "logical_name": "LIC",
      "display_name": "Line Items",
      "physical": {
        "catalog": null,
        "schema": "public",
        "table": "line_items"
      },
      "alias": "lic",
      "fields": {}
    }
  },
  "relationships": [
    {
      "primary_table": "SLS",
      "joined_table": "LIC",
      "source": "InvoiceNo",
      "target": "InvoiceNo",
      "join_type": "inner"
    }
  ],
  "capabilities": {
    "supports_live_query": true,
    "supports_snapshot": true
  }
}
```

### 6.3 TypeScript Types

Add or replace in a new shared file, for example:

`src/lib/data-sources/types.ts`

```typescript
export type SourceKind = "filemaker" | "sql";

export type SqlProvider =
  | "postgres"
  | "mysql"
  | "mariadb"
  | "sqlserver"
  | "sqlite"
  | "oracle"
  | "snowflake"
  | "bigquery";

export type NormalizedFieldType =
  | "text"
  | "number"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "time"
  | "json"
  | "binary"
  | "unknown";

export interface SqlSourceRef {
  kind: "sql";
  provider: SqlProvider;
  connection_id: string;
  schema_cache_version?: string;
}

export interface FileMakerSourceRef {
  kind: "filemaker";
  protocol: "data-api" | "o-data-api";
}

export type SourceRef = SqlSourceRef | FileMakerSourceRef;

export interface PhysicalTableRef {
  catalog?: string | null;
  schema?: string | null;
  table: string;
}

export interface FieldConfigV2 {
  physical_name: string;
  type: NormalizedFieldType;
  source_data_type?: string;
  label: string;
  prefix?: string;
  suffix?: string;
  valuelist?: string;
  nullable?: boolean;
  is_primary_key?: boolean;
  is_indexed?: boolean;
}

export interface TableConfigV2 {
  logical_name: string;
  display_name?: string;
  physical: PhysicalTableRef;
  alias?: string;
  fields: Record<string, FieldConfigV2>;
}

export interface RelationshipV2 {
  primary_table: string;
  joined_table: string;
  source: string;
  target: string;
  join_type?: "inner" | "left";
}

export interface SetupConfigV2 {
  version: 2;
  source: SourceRef;
  tables: Record<string, TableConfigV2>;
  relationships: RelationshipV2[];
  capabilities?: Record<string, boolean>;
}
```

### 6.4 Backward Compatibility Detection

Create a setup resolver:

`src/lib/report-engine/setupResolver.ts`

Behavior:

```typescript
function detectSetupVersion(setup: unknown): "filemaker-v1" | "sql-v2" {
  if (setup && setup.version === 2 && setup.source?.kind === "sql") {
    return "sql-v2";
  }

  return "filemaker-v1";
}
```

Routing:

```text
filemaker-v1 -> existing FileMaker engine path
sql-v2       -> new SQL source engine path
```

---

## 7. Source Adapter Layer

### 7.1 Directory Structure

Create:

```text
src/lib/data-sources/
  adapters/
    postgresAdapter.ts
    mysqlAdapter.ts
    sqlServerAdapter.ts
    sqliteAdapter.ts
  dialects/
    postgresDialect.ts
    mysqlDialect.ts
    sqlServerDialect.ts
    sqliteDialect.ts
  connectionResolver.ts
  registry.ts
  schemaIntrospection.ts
  secretResolver.ts
  types.ts
```

### 7.2 Adapter Interface

```typescript
export interface SourceConnectionConfig {
  connectionId: string;
  companyId: string;
  provider: SqlProvider;
  host?: string;
  port?: number;
  databaseName?: string;
  defaultSchema?: string | null;
  username?: string;
  password?: string;
  connectionString?: string;
  sslMode?: string | null;
  options?: Record<string, unknown>;
}

export interface ColumnMetadata {
  catalogName?: string | null;
  schemaName?: string | null;
  tableName: string;
  tableType?: string | null;
  columnName: string;
  ordinalPosition?: number | null;
  sourceDataType: string;
  normalizedType: NormalizedFieldType;
  nullable?: boolean | null;
  primaryKey?: boolean;
  indexed?: boolean;
  numericPrecision?: number | null;
  numericScale?: number | null;
  maxLength?: number | null;
}

export interface QueryExecutionResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount?: number;
  durationMs: number;
}

export interface SqlSourceAdapter {
  provider: SqlProvider;
  capabilities: DialectCapabilities;

  testConnection(config: SourceConnectionConfig): Promise<void>;

  introspect(config: SourceConnectionConfig): Promise<ColumnMetadata[]>;

  execute<T = Record<string, unknown>>(
    config: SourceConnectionConfig,
    compiled: CompiledSql
  ): Promise<QueryExecutionResult<T>>;

  streamRows?(
    config: SourceConnectionConfig,
    compiled: CompiledSql,
    onRows: (rows: Record<string, unknown>[]) => Promise<void>
  ): Promise<void>;
}
```

### 7.3 Dialect Capabilities

```typescript
export interface DialectCapabilities {
  parameterStyle: "dollar" | "question" | "named";
  identifierQuote: "double" | "backtick" | "bracket";
  supportsOffsetFetch: boolean;
  supportsLimitOffset: boolean;
  supportsWindowFunctions: boolean;
  supportsIlike: boolean;
  supportsNullsLast: boolean;
  supportsReadOnlyTransaction: boolean;
  maxParameters?: number;
}
```

Provider differences:

| Provider | Identifier Quote | Parameter Style | Pagination |
|---|---|---|---|
| PostgreSQL | `"table"` | `$1`, `$2` | `LIMIT $n OFFSET $n` |
| MySQL/MariaDB | `` `table` `` | `?` | `LIMIT ? OFFSET ?` |
| SQL Server | `[table]` | `@p1`, `@p2` | `ORDER BY ... OFFSET @p ROWS FETCH NEXT @p ROWS ONLY` |
| SQLite | `"table"` | `?` | `LIMIT ? OFFSET ?` |

### 7.4 Driver Dependencies

Implementation will require adding provider drivers:

```text
postgres: pg
mysql/mariadb: mysql2
sqlserver: mssql
sqlite: better-sqlite3 or sqlite3, only if local file support is approved
```

Do not install all future provider drivers upfront. Add only P0 provider drivers during implementation to keep bundle/dependency risk controlled.

### 7.5 Connection Pooling

Serverless constraints:

- Next.js API routes may run in stateless serverless contexts.
- Long-lived pools can exhaust customer DB connections if not capped.
- Some customer databases will require IP allowlisting or private networking.

V1 policy:

- Use small per-provider pool limits.
- Set query timeout on every query.
- Close or release connections in `finally`.
- Prefer read-only source credentials.
- Add an operational note for Vercel deployment: customer DBs must be reachable from the deployed runtime or use a connector/warehouse mode.

---

## 8. Query Specification Layer

### 8.1 Why QuerySpec Is Required

Do not build SQL by concatenating strings from `ReportConfigJSON`.

Instead:

```text
ReportConfigJSON + SetupConfigV2
  -> validate all logical table/field refs
  -> QuerySpec
  -> DialectCompiler
  -> parameterized SQL
```

This gives:

- Provider independence.
- Identifier allowlisting.
- Parameterized values.
- Testable query building.
- Safer future support for additional dialects.

### 8.2 QuerySpec Types

Create:

`src/lib/report-engine/querySpec.ts`

```typescript
export interface QueryFieldRef {
  logicalTable: string;
  logicalField: string;
  physicalTable: PhysicalTableRef;
  physicalColumn: string;
  alias: string;
  normalizedType: NormalizedFieldType;
}

export interface QueryJoin {
  type: "inner" | "left";
  left: QueryFieldRef;
  right: QueryFieldRef;
}

export interface QueryFilter {
  field: QueryFieldRef;
  operator:
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "contains"
    | "not_empty"
    | "empty"
    | "between";
  value?: unknown;
  valueTo?: unknown;
}

export interface QuerySort {
  field: QueryFieldRef | CalculatedFieldRef;
  direction: "asc" | "desc";
}

export interface QueryAggregate {
  function: "sum" | "avg" | "count" | "min" | "max";
  field: QueryFieldRef | CalculatedFieldRef;
  alias: string;
}

export interface QuerySpec {
  source: SqlSourceRef;
  from: {
    table: string;
    physical: PhysicalTableRef;
    alias: string;
  };
  joins: QueryJoin[];
  select: Array<QueryFieldRef | CalculatedFieldRef>;
  filters: QueryFilter[];
  orderBy: QuerySort[];
  aggregates: QueryAggregate[];
  groupBy: QueryFieldRef[];
  limit?: number;
  offset?: number;
}

export interface CompiledSql {
  sql: string;
  params: unknown[];
  redactedSql: string;
  redactedParams: unknown[];
}
```

### 8.3 Logical Field Resolution

Rules:

- `table` and `field` from report config are logical names.
- Logical names must exist in `setup.tables`.
- Physical identifiers come only from setup/schema cache.
- If a field exists in multiple logical tables, the report config must specify the table.
- If a field is missing, return a validation error before compiling SQL.

Example:

```text
ReportConfig:
  { table: "SLS", field: "InvoiceNo" }

SetupConfigV2:
  tables.SLS.physical.table = "sales_orders"
  tables.SLS.fields.InvoiceNo.physical_name = "invoice_no"

Compiled SQL:
  sls."invoice_no" AS "SLS.InvoiceNo"
```

---

## 9. SQL Compilation Strategy

### 9.1 Generated Query Family

For each report run, compile multiple SQL statements from the same base query:

1. Page query
2. Count query
3. Grand summary query
4. Group summary query
5. Snapshot streaming query, only when saving an immutable report

All queries share:

- `FROM`
- `JOIN`
- `WHERE`
- calculated field expressions where SQL-compilable

### 9.2 Base CTE Pattern

Preferred compiler output:

```sql
WITH base AS (
  SELECT
    sls.invoice_no AS "SLS.InvoiceNo",
    sls.sales_date AS "SLS.SalesDate",
    lic.line_price AS "LIC.LinePrice"
  FROM sales_orders sls
  INNER JOIN line_items lic
    ON sls.invoice_no = lic.invoice_no
  WHERE sls.sales_date BETWEEN $1 AND $2
)
SELECT *
FROM base
ORDER BY "SLS.SalesDate" DESC, "SLS.InvoiceNo" ASC
LIMIT $3 OFFSET $4;
```

If a provider has weak CTE support or different syntax, the dialect compiler can inline the base query.

### 9.3 Count Query

```sql
WITH base AS (...)
SELECT COUNT(*) AS total_rows
FROM base;
```

Optional optimization:

- If a provider supports window functions efficiently, page query can include `COUNT(*) OVER()`.
- Keep separate count query as the simpler V1 baseline.

### 9.4 Grand Summary Query

```sql
WITH base AS (...)
SELECT
  COALESCE(SUM("LIC.LinePrice"), 0) AS "LIC.LinePrice"
FROM base;
```

Rules:

- Only numeric fields can be summed.
- Cast text-like numeric source columns explicitly only if setup marks them safe.
- Nulls become zero for sums.
- Summary fields must resolve to selected or available fields.

### 9.5 Group Summary Query

```sql
WITH base AS (...)
SELECT
  "REG.RegionName" AS group_value,
  COUNT(*) AS row_count,
  COALESCE(SUM("LIC.LinePrice"), 0) AS "LIC.LinePrice"
FROM base
GROUP BY "REG.RegionName"
ORDER BY "REG.RegionName" ASC;
```

For multiple group levels, run one grouped query per group config in V1. Later, providers with advanced grouping support can use `ROLLUP` or grouping sets.

### 9.6 Pagination

V1:

- Use offset pagination.
- Enforce a maximum page size, for example 500.
- Default page size should be 100.
- Always add deterministic ordering.

If the config has no `body_sort_order`, add a stable fallback:

```text
ORDER BY first selected field ASC
```

If a primary key is known, append it as a tie-breaker:

```text
ORDER BY configured_sort, primary_key ASC
```

V2 optimization:

- Add keyset pagination for very deep pages.

### 9.7 Filter Operator Mapping

Current FileMaker-style filters must map to SQL:

| Existing Filter Value | Meaning | SQL Mapping |
|---|---|---|
| `*` | not empty | `IS NOT NULL` and not empty string for text |
| `=` or empty | empty | `IS NULL` or empty string for text |
| `=Value` | exact | `= ?` |
| `!=Value` | not equal | `<> ?` |
| `>Value` | greater than | `> ?` |
| `>=Value` | greater or equal | `>= ?` |
| `<Value` | less than | `< ?` |
| `<=Value` | less or equal | `<= ?` |
| `A...B` | range | `BETWEEN ? AND ?` |
| plain text | contains | provider-specific case-insensitive contains |

Provider-specific contains:

- PostgreSQL: `ILIKE '%' || $n || '%'`
- MySQL/MariaDB: `LOWER(col) LIKE LOWER(CONCAT('%', ?, '%'))`
- SQL Server: `LOWER(col) LIKE '%' + LOWER(@p) + '%'`
- SQLite: `LOWER(col) LIKE '%' || LOWER(?) || '%'`

### 9.8 Date Range Handling

Current report docs use `MM/DD/YYYY...MM/DD/YYYY`.

SQL engine rules:

- Parse date strings server-side into ISO dates.
- Bind date values as parameters, not interpolated strings.
- Use field normalized type to decide date vs datetime handling.
- For date-only ranges on datetime fields, use inclusive start and exclusive next-day end:

```text
created_at >= start_date_00_00_00
created_at < day_after_end_date_00_00_00
```

This avoids missing records late in the end date.

---

## 10. Calculated Fields

### 10.1 Current Behavior

The current engine uses HyperFormula in JavaScript after rows are stitched.

Problem:

- This does not scale for full datasets.
- Summaries for calculated fields cannot be correct unless the calculation can run across all rows or be pushed to SQL.

### 10.2 V1 Calculated Field Policy

Classify every calculated field:

| Class | Example | V1 Behavior |
|---|---|---|
| Row arithmetic | `=Quantity * UnitPrice` | Compile to SQL expression. |
| Row conditional | `=IF(LinePrice=0,0,(LinePrice-Cost)/LinePrice)` | Compile to `CASE WHEN`. |
| Aggregate formula | `=SUM(LinePrice)` | Map to aggregate query only. |
| Unsupported formula | complex spreadsheet function | Reject for source-level summary; allow page-only preview only if explicitly non-summary. |

### 10.3 Formula Safety

Rules:

- Never use `eval`.
- Never paste formula text directly into SQL.
- Parse formulas into an AST.
- Allowlist functions and operators.
- Resolve every dependency to a known logical field.
- Compile only known AST nodes to SQL.

Initial allowlist:

```text
Operators:
  +, -, *, /, %, parentheses

Functions:
  IF
  ABS
  ROUND
  MIN
  MAX

Aggregates:
  SUM
  AVG
  COUNT
```

Unsupported formulas should fail validation with a specific message:

```text
Calculated field "GrossMarginPct" uses unsupported function "XLOOKUP" for SQL source execution.
```

### 10.4 Division by Zero

The compiler must protect division:

```sql
field_a / NULLIF(field_b, 0)
```

For `IF(field_b=0,0,field_a/field_b)`, compile to:

```sql
CASE WHEN field_b = 0 THEN 0 ELSE field_a / NULLIF(field_b, 0) END
```

---

## 11. Report Engine Flow

### 11.1 Internal API Contract

Update `/api/generate-report` to accept mode and template context:

```json
{
  "template_id": "uuid",
  "report_setup": {},
  "report_config": {},
  "run_mode": "preview",
  "page": 1,
  "limit": 100,
  "persist_snapshot": false
}
```

Supported `run_mode`:

```text
preview
template_update
saved_report
chart
insight
```

### 11.2 SQL Engine Facade

Create:

`src/lib/report-engine/reportEngineFacade.ts`

Responsibilities:

1. Detect setup version/source kind.
2. Route legacy FileMaker setup to current engine.
3. Route SQL setup to new SQL engine.
4. Return one normalized response shape to API routes.

```typescript
export interface ReportEngineInput {
  companyId: string;
  templateId: string;
  setupJson: unknown;
  configJson: unknown;
  runMode: "preview" | "template_update" | "saved_report" | "chart" | "insight";
  page?: number;
  limit?: number;
  persistSnapshot?: boolean;
  generatedByUserId?: string | null;
}

export interface ReportEngineOutput {
  status: "ok";
  runId: string;
  reportId?: string | null;
  reportStructureJson: unknown[];
  rows: Record<string, unknown>[];
  totalRows: number;
  summaryJson: Record<string, unknown>;
  processingLogs: string[];
}
```

### 11.3 SQL Engine Steps

```text
Step 1: Resolve company-scoped source connection.
Step 2: Resolve secret by secret_ref on the server.
Step 3: Validate setup JSON shape and source provider.
Step 4: Validate report config against setup/schema cache.
Step 5: Build QuerySpec.
Step 6: Compile page/count/summary queries for the provider dialect.
Step 7: Insert report_query_runs row with status = running.
Step 8: Execute count query.
Step 9: Execute summary queries.
Step 10: Execute page query.
Step 11: Build report_structure_json metadata.
Step 12: If saved_report, create reports row and materialize snapshot rows.
Step 13: Mark report_query_runs status = ready.
Step 14: Return page rows, summary, total_rows, and logs.
```

### 11.4 Report Structure Contract

Current renderers expect a structure like:

```json
[
  { "TitleHeader": {} },
  { "Subsummary": {} },
  { "Body": {} },
  { "TrailingGrandSummary": {} }
]
```

Keep this structure but change body data handling for SQL source reports:

```json
[
  { "TitleHeader": { "MainHeading": "Sales Report", "SubHeading": "Kibizsystems.com" } },
  { "Subsummary": {} },
  {
    "Body": {
      "BodyField": [],
      "BodyFieldOrder": ["Invoice No", "Sales Date", "Line Price"],
      "BodySortOrder": [],
      "FieldPrefix": {},
      "FieldSuffix": {},
      "Sorting": []
    }
  },
  { "TrailingGrandSummary": { "TrailingGrandSummary": ["Line Price"] } },
  {
    "ResultMeta": {
      "sourceKind": "sql",
      "sessionBased": true,
      "runId": "uuid",
      "reportId": "uuid-or-null",
      "totalRows": 50000,
      "pageSize": 100,
      "rowKeyFormat": "logicalTable.field"
    }
  }
]
```

Backward compatibility:

- Legacy reports without `ResultMeta.sessionBased` render from embedded `BodyField`.
- SQL source reports use paginated rows and summary JSON.

---

## 12. Saved Report Snapshot Strategy

### 12.1 Why Snapshots Still Matter

The application architecture document defines reports as immutable runtime outputs. Charts and insights depend on saved reports, not direct database queries.

Therefore, direct SQL source query is enough for previews/live dashboards, but saved report history must either:

1. Store an immutable snapshot, or
2. Explicitly become a live view that changes when source data changes.

Default V1 decision:

```text
Saved reports are immutable snapshots.
```

### 12.2 Snapshot Persistence Flow

When user clicks Generate:

```text
1. Compile source query.
2. Execute count and summaries.
3. Create reports row with small metadata JSON.
4. Stream source rows in batches.
5. Insert rows into report_result_rows.
6. Return first page to frontend.
7. Charts and insights use report_result_rows by report_id.
```

### 12.3 Snapshot Batch Size

Recommended initial values:

```text
Source fetch batch size: 1000 to 5000 rows
Supabase insert batch size: 500 to 1000 rows
Frontend page size: 100 rows
Maximum frontend page size: 500 rows
```

Batch size should be provider-configurable after performance testing.

### 12.4 Report Metadata Storage

`reports.report_data_json` should store small metadata:

```json
{
  "report_structure_json": [],
  "summary_json": {},
  "total_rows": 50000,
  "run_id": "uuid",
  "row_storage": "report_result_rows",
  "row_key_format": "logicalTable.field",
  "source_snapshot": {
    "connection_id": "uuid",
    "provider": "postgres",
    "query_hash": "sha256"
  }
}
```

Do not store all rows in `report_data_json`.

---

## 13. API Changes

### 13.1 Source Connection APIs

Create:

```text
POST   /api/data-sources/connections
GET    /api/data-sources/connections
GET    /api/data-sources/connections/[connection_id]
PATCH  /api/data-sources/connections/[connection_id]
DELETE /api/data-sources/connections/[connection_id]
POST   /api/data-sources/connections/[connection_id]/test
POST   /api/data-sources/connections/[connection_id]/sync-schema
GET    /api/data-sources/connections/[connection_id]/schema
```

All routes:

- Require session.
- Enforce `company_id`.
- Use `createAdminClient()`.
- Never return secret payloads.

### 13.2 Schema Sync API

`POST /api/data-sources/connections/[connection_id]/sync-schema`

Response:

```json
{
  "success": true,
  "data": {
    "connection_id": "uuid",
    "tables": 22,
    "columns": 340,
    "synced_at": "2026-06-03T10:00:00.000Z"
  }
}
```

### 13.3 Report Rows API

Create:

```text
GET /api/reports/[report_id]/rows?page=1&limit=100
```

Response:

```json
{
  "success": true,
  "data": {
    "rows": [],
    "page": 1,
    "limit": 100,
    "total_rows": 50000,
    "has_more": true
  }
}
```

This reads from `report_result_rows` for immutable saved reports.

### 13.4 Template Preview Rows API

For live preview runs that are not saved:

```text
POST /api/templates/[template_id]/preview
```

Body:

```json
{
  "runtime_filters": {},
  "config_json": {},
  "page": 1,
  "limit": 100
}
```

This executes direct SQL page queries without persisting full rows.

### 13.5 Stream Route Compatibility

Keep:

```text
POST /api/templates/[template_id]/generate/stream
```

Change internals:

- Resolve setup and config as today.
- Call `reportEngineFacade`.
- For SQL source, return progress logs and first page metadata.
- Persist snapshot for user generate.
- Persist template preview metadata for admin template update.

SSE `done` event:

```json
{
  "type": "done",
  "report_structure_json": [],
  "rows": [],
  "summary_json": {},
  "total_rows": 50000,
  "run_id": "uuid",
  "report_id": "uuid",
  "report_name": "Sales Report"
}
```

---

## 14. Frontend Changes

### 14.1 Setup Wizard

Affected files:

```text
src/components/setup/HostConfigSection.tsx
src/components/setup/AddDatabaseSection.tsx
src/components/setup/SetupWizard.tsx
src/components/setup/TableCard.tsx
src/components/setup/RelationshipsPanel.tsx
src/components/setup/types.ts
src/components/setup/SetupLibraryModal.tsx
src/components/setup/SetupJsonPreview.tsx
```

Required changes:

1. Replace FileMaker-only provider UI with source provider selector.
2. Support provider options:
   - FileMaker legacy
   - PostgreSQL
   - MySQL/MariaDB
   - SQL Server
3. Add connection create/test flow.
4. Fetch table/column metadata from new `/api/data-sources/*` APIs.
5. Store `connection_id` and schema mappings in setup JSON.
6. Remove plaintext password handling from setup JSON preview.
7. Keep relationship builder logic but use logical table/field names.
8. Show schema sync status and last tested timestamp.

### 14.2 Generate Page

Affected file:

```text
src/app/[company_slug]/templates/[template_id]/generate/page.tsx
```

Required changes:

- Keep runtime filter UI.
- Keep SSE flow initially.
- Replace assumption that all body rows arrive inside `report_structure_json`.
- Add state:

```typescript
const [reportStructure, setReportStructure] = useState<any[] | null>(null);
const [pageRows, setPageRows] = useState<Record<string, unknown>[]>([]);
const [summaryJson, setSummaryJson] = useState<Record<string, unknown> | null>(null);
const [totalRows, setTotalRows] = useState(0);
const [currentPage, setCurrentPage] = useState(1);
const [isLoadingRows, setIsLoadingRows] = useState(false);
```

- On SQL `done`, render first page rows.
- For saved reports, fetch additional pages from `/api/reports/[report_id]/rows`.
- For legacy reports, continue rendering embedded `BodyField`.

### 14.3 Report Viewer Components

Affected files:

```text
src/components/DynamicReportPreview.tsx
src/components/report-viewer/ClassicReportView.tsx
```

Required changes:

- Support `ResultMeta.sessionBased`.
- Accept `bodyRows` separately from report structure.
- Resolve field labels from setup/config metadata.
- Render summary values from `summary_json`.
- Add pagination controls with fixed dimensions.
- Show skeleton loaders, not plain "Loading..." text, per frontend rules.

### 14.4 Charts

Current principle:

```text
Charts come from reports, not databases directly.
```

V1 SQL source behavior:

- Saved report charts read from `report_result_rows`.
- Template chart builder may use template preview rows or last generated preview metadata.
- Chart data processors must support row key format `logicalTable.field`.

Affected areas:

```text
src/components/chart-dashboard/*
src/lib/charts/*
src/app/api/report-templates/[template_id]/charts/*
```

### 14.5 Insights

Current principle:

- AI should not see raw source database credentials.
- AI should not see unnecessary raw data.
- Insight executor works from datasets and field schemas.

SQL source behavior:

- Use saved report snapshot rows for insight execution.
- For large reports, aggregate/sample server-side before sending to AI.
- Keep formula execution local/server-side.

Affected areas:

```text
src/lib/insights/*
src/components/insights/*
```

---

## 15. Backend Implementation Phases

### Phase 0 - Approval and Decisions

Before coding, confirm:

1. P0 providers: PostgreSQL, MySQL/MariaDB, SQL Server.
2. Secret storage choice.
3. Whether direct database access from deployment is acceptable.
4. Whether saved reports must remain immutable for every tenant.
5. Maximum expected row counts per saved report.

Deliverable:

- Approved plan and ticket.

### Phase 1 - SQL Migrations

Create SQL files in `ai-workspace/sql`:

```text
048_source_connections.sql
049_source_schema_cache.sql
050_report_query_runs.sql
051_report_result_rows.sql
```

Tasks:

1. Add `source_connections`.
2. Add secret storage table only if Vault is not used.
3. Add `source_schema_cache`.
4. Add `report_query_runs`.
5. Add `report_result_rows`.
6. Add optional FK columns to `report_template_setups` and `report_templates`.
7. Update `ai-workspace/docs/db-architecture.md`.

Validation:

- Apply migrations in local/test Supabase.
- Verify indexes exist.
- Verify RLS policy or service-role-only access rules.

### Phase 2 - Source Adapter Foundation

Create:

```text
src/lib/data-sources/types.ts
src/lib/data-sources/registry.ts
src/lib/data-sources/connectionResolver.ts
src/lib/data-sources/secretResolver.ts
src/lib/data-sources/adapters/postgresAdapter.ts
src/lib/data-sources/adapters/mysqlAdapter.ts
src/lib/data-sources/adapters/sqlServerAdapter.ts
```

Tasks:

1. Add driver dependencies.
2. Implement connection resolver from `source_connections`.
3. Implement secret resolver.
4. Implement test connection for each P0 provider.
5. Implement query execution with timeout.
6. Implement provider registry.

Validation:

- Unit test adapter registry.
- Integration test each provider with test containers or configured test databases.
- Verify failed connection messages are redacted.

### Phase 3 - Schema Introspection

Create:

```text
src/lib/data-sources/schemaIntrospection.ts
src/app/api/data-sources/connections/[connection_id]/sync-schema/route.ts
src/app/api/data-sources/connections/[connection_id]/schema/route.ts
```

Tasks:

1. Implement provider catalog queries.
2. Normalize data types.
3. Detect primary keys where possible.
4. Detect indexed columns where possible.
5. Store metadata in `source_schema_cache`.
6. Return UI-friendly tables/columns grouped by schema/table.

Validation:

- Test Postgres `information_schema`.
- Test MySQL `information_schema`.
- Test SQL Server `INFORMATION_SCHEMA` plus key metadata.
- Verify cache refresh replaces stale rows safely.

### Phase 4 - Setup Wizard V2

Tasks:

1. Extend setup types to support V2 SQL source setup.
2. Update provider selector.
3. Add source connection creation/test UI.
4. Add schema sync and table selection UI.
5. Reuse field label and formatting UI.
6. Reuse relationships UI.
7. Save setup JSON with `version: 2` and `source.kind: "sql"`.
8. Keep FileMaker legacy setup working.

Validation:

- Existing FileMaker setup still loads.
- New SQL setup saves without plaintext password.
- Setup JSON preview masks or omits secrets.
- Reusable setup library can store/apply V2 setup JSON.

### Phase 5 - QuerySpec Builder and Dialect Compilers

Create:

```text
src/lib/report-engine/querySpec.ts
src/lib/report-engine/querySpecBuilder.ts
src/lib/report-engine/dialects/baseDialect.ts
src/lib/report-engine/dialects/postgresDialect.ts
src/lib/report-engine/dialects/mysqlDialect.ts
src/lib/report-engine/dialects/sqlServerDialect.ts
src/lib/report-engine/filterCompiler.ts
src/lib/report-engine/calculatedFieldCompiler.ts
src/lib/report-engine/reportConfigValidator.ts
```

Tasks:

1. Validate all `ReportConfigJSON` table/field references.
2. Resolve logical names to physical identifiers.
3. Build provider-neutral QuerySpec.
4. Compile filters.
5. Compile joins.
6. Compile select list.
7. Compile order by.
8. Compile page/count/summary/group queries.
9. Compile supported calculated fields.
10. Reject unsupported formulas safely.

Validation:

- Snapshot test compiled SQL for each provider.
- Test identifier quoting.
- Test parameter ordering.
- Test invalid table/field rejection.
- Test filter operators.
- Test calculated field compilation.

### Phase 6 - SQL Report Engine

Create:

```text
src/lib/report-engine/sqlReportEngine.ts
src/lib/report-engine/reportEngineFacade.ts
src/lib/report-engine/reportStructureBuilder.ts
src/lib/report-engine/snapshotWriter.ts
```

Tasks:

1. Implement setup version detection.
2. Route V1 FileMaker to existing engine.
3. Route V2 SQL to SQL engine.
4. Execute count, summary, and page queries.
5. Build report structure metadata.
6. Write `report_query_runs`.
7. For saved report runs, create `reports` row and materialize `report_result_rows`.
8. Return first page rows.

Validation:

- Unit test report structure builder.
- Integration test SQL engine with a two-table report.
- Verify no full dataset is held in memory for normal preview.
- Verify saved report materialization works in batches.

### Phase 7 - API Route Integration

Modify:

```text
src/app/api/generate-report/route.ts
src/app/api/templates/[template_id]/generate/stream/route.ts
src/app/api/templates/[template_id]/generate/route.ts
```

Create:

```text
src/app/api/reports/[report_id]/rows/route.ts
src/app/api/templates/[template_id]/preview/route.ts
```

Tasks:

1. Make `/api/generate-report` use `reportEngineFacade`.
2. Preserve legacy response shape where needed.
3. Update stream route to handle SQL engine output.
4. Add paginated saved report rows endpoint.
5. Add live template preview endpoint.

Validation:

- Existing FileMaker report still generates.
- SQL report preview returns page rows and summary.
- SQL saved report creates `reports` and `report_result_rows`.
- API responses follow `{ success, data, error }` where public route conventions require it.

### Phase 8 - Frontend Rendering and Pagination

Modify:

```text
src/app/[company_slug]/templates/[template_id]/generate/page.tsx
src/components/DynamicReportPreview.tsx
src/components/report-viewer/ClassicReportView.tsx
```

Tasks:

1. Detect `ResultMeta.sessionBased`.
2. Store rows separately from structure.
3. Add row pagination fetch.
4. Render summary from `summary_json`.
5. Keep legacy embedded report rendering.
6. Ensure UI uses skeleton states.

Validation:

- Generate small SQL report.
- Generate large SQL report.
- Move between pages.
- Load old saved report.
- Confirm text does not overflow controls.

### Phase 9 - Charts and Insights Compatibility

Tasks:

1. Update chart data loaders to read from `report_result_rows` when report is session/snapshot based.
2. Keep legacy chart loading for embedded `report_data_json`.
3. Update insight field schema adapter to understand row key format.
4. Add aggregation/sampling guardrails for large snapshots.

Validation:

- Existing chart from legacy report still works.
- New chart from SQL saved report works.
- Insight executor receives schema and bounded dataset/aggregate input.

### Phase 10 - Hardening and Rollout

Tasks:

1. Add query timeout config.
2. Add max page size config.
3. Add max snapshot row count or background job fallback.
4. Add audit logs for query runs.
5. Add admin-visible connection status.
6. Add feature flag for SQL sources.
7. Add migration guide from FileMaker setup to SQL setup.

Validation:

- Disable feature flag and verify legacy behavior.
- Enable for one test company only.
- Verify failed SQL source does not break tenant workspace.

---

## 16. Security Model

### 16.1 Source Database Permissions

Customer/source credentials should be:

- Read-only.
- Restricted to required schemas/tables.
- Denied DDL/DML.
- Denied stored procedure execution unless explicitly approved later.
- Protected with SSL/TLS where supported.

### 16.2 Query Safety

Hard rules:

- No raw SQL editor in V1.
- No AI-generated raw SQL execution in V1.
- All identifiers must come from setup/schema cache.
- All values must be bound parameters.
- Sort fields must be allowlisted.
- Join relationships must be configured in setup JSON.
- Calculated fields must compile from an allowlisted AST.

### 16.3 Tenant Isolation

Every API route must:

1. Call `getSession()`.
2. Resolve `companyId`.
3. Ensure `source_connections.company_id` matches session company.
4. Ensure template/report belongs to session company unless platform admin.
5. Never expose another company's source schema or connection status.

### 16.4 Redaction

Logs may contain:

- provider
- connection_id
- template_id
- report_id
- query_hash
- duration
- row counts
- redacted SQL

Logs must not contain:

- passwords
- full connection strings
- tokens
- secret refs if considered sensitive
- raw parameter values that could contain customer data

---

## 17. Performance Model

### 17.1 Expected Improvements

Compared with current FileMaker/Node stitching:

- Joins move to source DB indexes.
- Filtering moves to source DB.
- Summaries move to source DB.
- Browser receives one page of rows.
- Saved report data no longer sits inside one JSONB field.
- Node memory is bounded by page or snapshot batch size.

### 17.2 Source Database Index Requirements

During setup validation, warn when:

- Join source/target fields are not indexed.
- Filtered date fields are not indexed.
- Sort fields are not indexed and expected row count is large.
- Group fields are high cardinality and unindexed.

Do not block V1 generation, but show performance warnings.

### 17.3 Query Budgets

Recommended defaults:

```text
query timeout: 30 seconds for preview, 300 seconds for saved snapshot
default page size: 100
max page size: 500
max selected columns: 50
max joins: 10
max group levels: 5
max snapshot rows without background job: 100000
```

If a saved report exceeds the synchronous snapshot threshold, move to background execution or return a clear "large report queued" state.

---

## 18. Rollback Strategy

### 18.1 Code Rollback

Keep FileMaker legacy engine path untouched until SQL engine is stable.

Rollback options:

- Disable SQL source feature flag.
- Route `setup.version !== 2` to legacy engine.
- Keep old report rendering for reports without `ResultMeta.sessionBased`.

### 18.2 Database Rollback

New tables are additive:

- `source_connections`
- `source_schema_cache`
- `report_query_runs`
- `report_result_rows`

Rollback can leave tables in place unused.

If optional FK columns are added:

- They can remain nullable.
- Existing templates are unaffected.

### 18.3 Data Rollback

Saved report snapshots:

- `reports` rows remain valid metadata.
- `report_result_rows` can be deleted per `report_id` if a run is invalid.
- `report_query_runs.status` can mark failed/cancelled runs.

---

## 19. Testing Strategy

### 19.1 Unit Tests

Targets:

```text
src/lib/report-engine/reportConfigValidator.ts
src/lib/report-engine/querySpecBuilder.ts
src/lib/report-engine/filterCompiler.ts
src/lib/report-engine/calculatedFieldCompiler.ts
src/lib/report-engine/dialects/*
src/lib/report-engine/reportStructureBuilder.ts
```

Cases:

- Invalid table reference.
- Invalid field reference.
- Invalid join reference.
- Filters operator mapping.
- Date range parsing.
- Identifier escaping.
- Parameter ordering.
- SQL Server pagination requires order by.
- MySQL contains filter.
- PostgreSQL ILIKE filter.
- Calculated field dependency resolution.
- Unsupported calculated field rejection.

### 19.2 Adapter Integration Tests

Minimum:

- PostgreSQL test database.
- MySQL/MariaDB test database.
- SQL Server test database if available in CI.

Cases:

- Test connection success/failure.
- Introspect schema.
- Run page query.
- Run count query.
- Run grand summary.
- Run group summary.
- Timeout failure.

### 19.3 API Tests

Targets:

```text
/api/data-sources/connections
/api/data-sources/connections/[connection_id]/test
/api/data-sources/connections/[connection_id]/sync-schema
/api/templates/[template_id]/preview
/api/templates/[template_id]/generate/stream
/api/reports/[report_id]/rows
```

Cases:

- Unauthorized user rejected.
- Wrong company rejected.
- Platform admin allowed only through explicit rules.
- Secret not returned.
- Schema sync scoped by company.
- Saved report rows paginated.

### 19.4 E2E Tests

Use Playwright:

1. Create source connection.
2. Test connection.
3. Sync schema.
4. Create setup from SQL tables.
5. Define relationships.
6. Build report config.
7. Generate preview.
8. Save report.
9. Page through report rows.
10. Open saved report history.
11. Generate chart from saved SQL report.

### 19.5 Large Dataset Test

Dataset:

- At least 50k base rows.
- At least one joined detail table.
- One date filter.
- One grouping.
- One numeric summary.
- One calculated field.

Assertions:

- API does not timeout under approved threshold.
- Node memory does not scale linearly with total rows during preview.
- Browser receives only page rows.
- Saved report row count equals source count.
- Summary equals source SQL control query.
- Chart data matches report data.

---

## 20. Implementation File Map

### New Backend Files

```text
src/lib/data-sources/types.ts
src/lib/data-sources/registry.ts
src/lib/data-sources/connectionResolver.ts
src/lib/data-sources/secretResolver.ts
src/lib/data-sources/schemaIntrospection.ts
src/lib/data-sources/adapters/postgresAdapter.ts
src/lib/data-sources/adapters/mysqlAdapter.ts
src/lib/data-sources/adapters/sqlServerAdapter.ts

src/lib/report-engine/querySpec.ts
src/lib/report-engine/querySpecBuilder.ts
src/lib/report-engine/reportConfigValidator.ts
src/lib/report-engine/filterCompiler.ts
src/lib/report-engine/calculatedFieldCompiler.ts
src/lib/report-engine/reportStructureBuilder.ts
src/lib/report-engine/sqlReportEngine.ts
src/lib/report-engine/reportEngineFacade.ts
src/lib/report-engine/snapshotWriter.ts
src/lib/report-engine/dialects/baseDialect.ts
src/lib/report-engine/dialects/postgresDialect.ts
src/lib/report-engine/dialects/mysqlDialect.ts
src/lib/report-engine/dialects/sqlServerDialect.ts
```

### New API Routes

```text
src/app/api/data-sources/connections/route.ts
src/app/api/data-sources/connections/[connection_id]/route.ts
src/app/api/data-sources/connections/[connection_id]/test/route.ts
src/app/api/data-sources/connections/[connection_id]/sync-schema/route.ts
src/app/api/data-sources/connections/[connection_id]/schema/route.ts
src/app/api/templates/[template_id]/preview/route.ts
src/app/api/reports/[report_id]/rows/route.ts
```

### Modified API Routes

```text
src/app/api/generate-report/route.ts
src/app/api/templates/[template_id]/generate/stream/route.ts
src/app/api/templates/[template_id]/generate/route.ts
src/app/api/company/templates/[template_id]/setup/route.ts
src/app/api/company/setups/route.ts
```

### Modified Frontend Files

```text
src/components/setup/types.ts
src/components/setup/HostConfigSection.tsx
src/components/setup/AddDatabaseSection.tsx
src/components/setup/SetupWizard.tsx
src/components/setup/TableCard.tsx
src/components/setup/SetupLibraryModal.tsx
src/components/setup/SetupJsonPreview.tsx
src/app/[company_slug]/templates/[template_id]/generate/page.tsx
src/components/DynamicReportPreview.tsx
src/components/report-viewer/ClassicReportView.tsx
```

### Modified Docs

```text
ai-workspace/docs/db-architecture.md
src/components/setup/agents.md
src/services/agents.md
```

---

## 21. Execution Order

Recommended order:

```text
1. Approve P-048.
2. Add SQL migrations for source metadata and result rows.
3. Update DB docs.
4. Add source adapter types and registry.
5. Add provider drivers and P0 adapters.
6. Add source connection APIs.
7. Add schema sync APIs.
8. Update setup wizard to create SQL setup V2.
9. Add QuerySpec builder and dialect compilers.
10. Add SQL report engine.
11. Integrate reportEngineFacade into /api/generate-report.
12. Update stream route.
13. Add saved report rows API.
14. Update generate page and report viewers.
15. Update charts and insights to read snapshot rows.
16. Add tests.
17. Run build and targeted tests.
18. Roll out behind SQL source feature flag.
```

---

## 22. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Source DB not reachable from Vercel/runtime | SQL source cannot connect | Require network validation in setup; offer warehouse/connector mode. |
| Plaintext credentials leak through JSONB | Critical security issue | Store `secret_ref` only; redact logs; server-only secret resolver. |
| SQL injection through field names | Critical security issue | Identifier allowlist from setup/schema cache; no raw SQL. |
| SQL injection through filter values | Critical security issue | Parameterized values only. |
| Provider dialect differences | Incorrect queries | Dialect compiler test snapshots per provider. |
| Large saved reports still too large | Timeout/storage pressure | Batch snapshot writes; queue very large runs. |
| Source DB performance impact | Customer operational DB slows down | Read-only replicas, warehouses, query budgets, index warnings. |
| Calculated fields not SQL-compilable | Wrong summaries | Classify formulas; reject unsupported summary formulas. |
| Existing FileMaker templates break | Regression | Keep legacy path; detect setup version. |
| Charts expect embedded row arrays | Chart regression | Add row loader abstraction for legacy vs snapshot reports. |

---

## 23. Open Questions Before Implementation

1. Which SQL providers are required for V1: PostgreSQL, MySQL/MariaDB, SQL Server, or a different first set?
2. Should saved reports always be immutable snapshots, or can some tenants opt into live reports that re-query the source database?
3. Which secret backend should be used in production: Supabase Vault, external KMS, or app-managed encryption?
4. Will customer databases be reachable directly from KiBiAI deployment, or is a connector/agent required?
5. What is the expected upper bound for saved report rows per tenant/report?

Default assumptions for this plan:

- V1 providers are PostgreSQL, MySQL/MariaDB, and SQL Server.
- Saved reports remain immutable snapshots.
- Source credentials are read-only.
- Direct SQL connectivity is allowed for customers who configure it.
- Warehouse/mirror mode remains an optional deployment pattern, not the core engine design.

---

## 24. Success Criteria

The migration is successful when:

- A tenant can create a SQL source connection without storing plaintext secrets in setup JSON.
- The setup wizard can introspect SQL schemas and build relationships.
- A report template can generate from PostgreSQL, MySQL/MariaDB, or SQL Server using the same `ReportConfigJSON` semantics.
- Large reports are paginated at the database/API level.
- Summary and group totals are computed by SQL.
- Saved report history remains immutable and does not store massive row arrays in `reports.report_data_json`.
- Existing FileMaker reports still work during transition.
- Charts and insights still derive from saved report outputs.
- Tests cover provider compilation, query execution, API access control, frontend pagination, and backward compatibility.
