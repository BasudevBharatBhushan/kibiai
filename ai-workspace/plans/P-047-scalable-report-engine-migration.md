# P-047 — Scalable Report Engine Migration
## Template-Keyed, Paginated, Supabase-Backed Architecture

---

## 1. CONTEXT & BACKGROUND

### Current Architecture (What Exists Today)

```
Frontend (page.tsx)
  └── POST /api/templates/[template_id]/generate/stream  (stream/route.ts)
        └── POST /api/generate-report  (route.ts)
              ├── InMemoryDataManager  (holds ALL records in Node.js RAM)
              ├── fetchDataFromAPI()   (single FM request, limit=5000, no pagination)
              ├── stitch()             (O(n×m) nested loop join — CRITICAL BUG)
              └── generateReportStructure()  (returns full BodyField[] to client)
```

**Problems at 50k+ rows:**
- `fetchDataFromAPI()` fires ONE request with `limit=5000`. Records beyond 5000 are silently dropped.
- `stitch()` does `resultData.forEach(base => joinDataset.filter(...))` — O(n×m). At 50k×50k = 2.5 billion comparisons. CPU freeze / OOM guaranteed.
- Full `BodyField[]` JSON (50k objects) sent through SSE to client → browser freeze.
- `stitch_result` saved to `reports.report_data_json` → impossible for 50k+ rows (Supabase row size limit).

### Key Files and Their Roles

| File | Role |
|---|---|
| `src/app/api/generate-report/route.ts` | Core engine: `fetchDataFromAPI`, `processFetchOrder`, `stitch`, `generateReportStructure`, POST handler |
| `src/app/api/templates/[template_id]/generate/stream/route.ts` | SSE wrapper, calls `/api/generate-report`, streams logs, saves to Supabase |
| `src/lib/utils/utility.ts` | `fetchFmRecord()` — handles DataAPI + ODataAPI, returns `{ data, recordCount, token }` |
| `src/lib/DataManager.ts` | `InMemoryDataManager` class (to be retired) |
| `src/app/[company_slug]/templates/[template_id]/generate/page.tsx` | Frontend: SSE stream consumer, renders report, handles pagination |
| `src/utils/supabase/server.ts` | `createAdminClient()` — Supabase service role client |

### Critical Observation: `fetchFmRecord()` Already Returns `foundCount`

At line 433 of `utility.ts`:
```typescript
return {
  token,
  data: FlattenedRecord,
  recordCount: data.response?.dataInfo?.foundCount || 0, // ← foundCount is HERE
};
```

The `foundCount` is already available — it just isn't being used to loop. The current code fetches page 1 (offset=1, limit=5000) and stops.

---

## 2. DESIGN DECISION: Simplified Single-Table Schema

### Why NOT a separate `report_sessions` table

A `report_sessions` table would create one row per report run — accumulating thousands of orphaned session records and requiring cleanup jobs. Instead:

- **One active dataset per template** — when you regenerate a report for a template, the old rows are deleted and new ones inserted.
- **Metadata lives on `report_templates`** — 5 new columns store status, totals, and summaries. No second table needed.
- **`report_session_rows` keyed by `template_id`** — simple, direct, no UUID session indirection.

### Trade-offs accepted

| Concern | Decision |
|---|---|
| Only one active dataset per template | ✅ Accepted — this is the desired behaviour |
| Concurrent generation by two users | ✅ Handled with a `processing` status guard |
| No per-run history of different filter runs | ✅ Accepted — `reports` table still stores config history |
| No garbage accumulation | ✅ This is the whole point |

---

## 3. NEW PROPOSED ARCHITECTURE

```
Frontend (page.tsx)
  └── POST /api/templates/[template_id]/generate/stream  (same SSE entry point)
        └── NEW internal engine flow:
              1. Guard: set report_templates.session_status = 'processing'
                        (reject if already 'processing')
              2. DELETE all report_session_rows WHERE template_id = ?
              3. Loop FM pages until foundCount exhausted:
                 a. Fetch page of 5000 primary rows from FileMaker
                 b. Extract pkeys → fetch joined rows (scoped to current page pkeys)
                 c. Hash-map join O(n+m) → produce stitched rows for this page
                 d. Bulk INSERT stitched rows into report_session_rows
                 e. Free memory → next page
              4. Compute grand summary / group summaries via SQL
              5. Update report_templates:
                    session_status = 'ready'
                    session_total_rows = X
                    session_summary_json = {...}
                    session_report_structure = [...]
                    session_last_generated_at = now()
              6. SSE sends summary + structure to frontend (NOT full rows)
              7. Frontend renders summary, fetches body rows via paginated API
```

---

## 4. DATABASE SCHEMA CHANGES

### 4.1 New Table: `report_session_rows`

```sql
-- Migration: 0XX_report_session_rows.sql

CREATE TABLE report_session_rows (
  id           BIGSERIAL PRIMARY KEY,
  template_id  UUID NOT NULL
               REFERENCES report_templates(report_template_id) ON DELETE CASCADE,
  row_index    INTEGER NOT NULL,   -- global row order (0-based), for stable pagination
  row_data     JSONB NOT NULL      -- stitched, pre-joined row using field machine keys (NOT labels)
);

-- Indexes (critical for pagination performance)
CREATE INDEX idx_session_rows_template    ON report_session_rows(template_id);
CREATE INDEX idx_session_rows_template_offset ON report_session_rows(template_id, row_index);

-- GIN index for JSONB aggregation queries
CREATE INDEX idx_session_rows_data_gin    ON report_session_rows USING GIN (row_data);
```

> **`row_data` format — machine keys only, NEVER labels:**
> ```json
> {
>   "SalesOrders.sales_total":   1500.00,
>   "SalesOrders.customer_name": "Acme Corp",
>   "Invoices.invoice_date":     "2025-03-15"
> }
> ```
> Key format: `"TableName.fieldName"` (dot-separated).
> Labels (e.g. `"Sales Total ($)"`) are resolved at render time using `setupJson.tables[table].fields[field].label`. They are NEVER stored in the database.

---

### 4.2 Modified Table: `report_templates` (add 5 columns)

```sql
-- Migration: 0XX_report_templates_session_columns.sql

ALTER TABLE report_templates
  ADD COLUMN session_status            TEXT    DEFAULT NULL
    CHECK (session_status IN ('processing', 'ready', 'failed')),
  ADD COLUMN session_total_rows        INTEGER DEFAULT NULL,
  ADD COLUMN session_summary_json      JSONB   DEFAULT NULL,
  ADD COLUMN session_report_structure  JSONB   DEFAULT NULL,
  ADD COLUMN session_last_generated_at TIMESTAMPTZ DEFAULT NULL;
```

Column purposes:

| Column | Purpose |
|---|---|
| `session_status` | `processing` → generation in progress; `ready` → rows available; `failed` → error occurred |
| `session_total_rows` | Total stitched row count — used by frontend for pagination UI |
| `session_summary_json` | Pre-computed grand totals and group subtotals (SQL-aggregated) |
| `session_report_structure` | `generateReportStructureMetadata()` output — layout without body rows |
| `session_last_generated_at` | Timestamp of last successful generation |

---

### 4.3 No Changes to `reports` Table

The `reports` table (history) stays as-is. Each history record stores:
- `report_config_json` — filters and config used for that run
- `report_data_json` — the `session_report_structure` (layout only, no body rows)

No `report_session_id` FK needed since rows are keyed by `template_id` directly.

---

### 4.4 Supabase RPC Functions

```sql
-- Migration: 0XX_report_session_rpcs.sql

-- Grand summary: SUM all requested numeric fields for a template's rows
CREATE OR REPLACE FUNCTION compute_grand_summary(
  p_template_id UUID,
  p_field_keys  TEXT[]          -- array of "TableName.fieldName" keys
) RETURNS JSONB AS $$
DECLARE
  result    JSONB := '{}'::JSONB;
  field_key TEXT;
  field_sum NUMERIC;
BEGIN
  FOREACH field_key IN ARRAY p_field_keys LOOP
    SELECT COALESCE(SUM((row_data->>field_key)::numeric), 0)
    INTO field_sum
    FROM report_session_rows
    WHERE template_id = p_template_id;

    result := result || jsonb_build_object(field_key, field_sum);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;


-- Group summary: SUM of numeric fields grouped by a JSONB field value
CREATE OR REPLACE FUNCTION compute_group_summary(
  p_template_id      UUID,
  p_group_field_key  TEXT,      -- e.g. "SalesOrders.salesperson"
  p_total_field_keys TEXT[]     -- e.g. ["SalesOrders.sales_total", "SalesOrders.qty"]
) RETURNS JSONB AS $$
DECLARE
  result    JSONB := '[]'::JSONB;
  rec       RECORD;
  row_obj   JSONB;
  field_key TEXT;
  field_sum NUMERIC;
BEGIN
  FOR rec IN
    SELECT
      row_data->>p_group_field_key AS group_value,
      COUNT(*)                     AS row_count
    FROM report_session_rows
    WHERE template_id = p_template_id
    GROUP BY row_data->>p_group_field_key
    ORDER BY row_data->>p_group_field_key
  LOOP
    row_obj := jsonb_build_object(
      'group_value', rec.group_value,
      'row_count',   rec.row_count
    );

    FOREACH field_key IN ARRAY p_total_field_keys LOOP
      SELECT COALESCE(SUM((row_data->>field_key)::numeric), 0)
      INTO field_sum
      FROM report_session_rows
      WHERE template_id = p_template_id
        AND row_data->>p_group_field_key = rec.group_value;

      row_obj := row_obj || jsonb_build_object(field_key, field_sum);
    END LOOP;

    result := result || jsonb_build_array(row_obj);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## 5. IMPLEMENTATION PHASES

---

### PHASE 1 — Fix `fetchFmRecord()` to Support True Pagination

**File:** `src/lib/utils/utility.ts`

**Current behavior:** Hardcoded `offset=1, limit=5000`. Stops after one page.

**Required change:** Accept `offset` and `limit` as optional parameters.

#### 1.1 Update `FetchFmDataRequest` interface

```typescript
// ADD two optional fields to the existing interface (lines 14-25):
export interface FetchFmDataRequest {
  raw_dataset?: any;
  p_key_field?: string;
  p_keys?: string[];
  filter?: Record<string, string>;
  table: string;
  host: string;
  database: string;
  version: string;
  data_fetching_protocol: string;
  session_token?: string;
  offset?: number;   // ← NEW: 1-based for FM Data API (default 1)
  limit?: number;    // ← NEW: records per page (default 5000)
}
```

#### 1.2 Update the Data API GET URL (line 349)

```typescript
// BEFORE:
let fetchUrl = `...records?_offset=1&_limit=5000`;

// AFTER:
const fmOffset = reqBody.offset ?? 1;
const fmLimit  = reqBody.limit  ?? 5000;
let fetchUrl = `...records?_offset=${fmOffset}&_limit=${fmLimit}`;
```

#### 1.3 Update both `_find` body constructions (lines 364 and 367)

```typescript
// BEFORE (both occurrences):
body = JSON.stringify({ query: queries, offset: 1, limit: 5000 });

// AFTER (both occurrences):
body = JSON.stringify({ query: queries, offset: fmOffset, limit: fmLimit });
```

#### 1.4 Update the return value to expose `foundCount` clearly

```typescript
// BEFORE (line 430-434):
return {
  token,
  data: FlattenedRecord,
  recordCount: data.response?.dataInfo?.foundCount || 0,
};

// AFTER:
return {
  token,
  data: FlattenedRecord,
  foundCount:     data.response?.dataInfo?.foundCount || 0,  // total matching in FM
  returnedCount:  FlattenedRecord.length,                    // records in THIS page
};
```

> **OData protocol note:** OData does not return `foundCount`. For OData, `foundCount` will always be `0`. The pagination loop detects this and uses `returnedCount < limit` as the stop signal instead.

---

### PHASE 2 — Rewrite `generate-report/route.ts` Engine Core

**File:** `src/app/api/generate-report/route.ts`

This file will be **completely rewritten**. The new engine:
- Takes `template_id` as input (in addition to `report_setup` and `report_config`)
- Deletes old rows for this template, then inserts fresh rows
- Returns `session_report_structure` + `summary_json` + `total_rows` (NOT full body rows)

---

#### 2.1 New Function: `fetchAllPagesFromFM()`

Replaces `fetchDataFromAPI()`. An **async generator** that yields each page of records from FileMaker until all records are retrieved.

```typescript
/**
 * Fetches ALL records for a FileMaker table using paginated requests.
 *
 * For DataAPI: uses foundCount from first response to drive pagination.
 * For OData:   stops when returnedCount < pageSize (no foundCount available).
 *
 * This is an async generator — it yields one page at a time, so memory
 * usage is bounded to pageSize records at any moment, not the full dataset.
 *
 * @param table    - layout/table name
 * @param setupJson - report setup (host, credentials, protocol)
 * @param filters  - normalized FM find filters
 * @param pKeyField - optional field name to filter by pkeys
 * @param pKeys    - optional pkey values (scopes the find)
 * @param pageSize - records per FM request (default 5000 = FM max)
 * @yields         - array of flattened FM records for each page
 */
async function* fetchAllPagesFromFM(
  table: string,
  setupJson: ReportSetupJson,
  filters: Record<string, any>,
  pKeyField?: string,
  pKeys?: string[],
  pageSize: number = 5000
): AsyncGenerator<any[]> {
  let offset = 1;
  let foundCount: number | null = null;
  let fmToken: string | null = null;

  // Case-insensitive table config lookup (existing pattern in codebase)
  let tableConfig = setupJson.tables[table];
  if (!tableConfig) {
    const foundKey = Object.keys(setupJson.tables).find(
      k => k.toLowerCase() === table.toLowerCase()
    );
    if (foundKey) tableConfig = setupJson.tables[foundKey];
  }
  if (!tableConfig) throw new Error(`Table config not found: ${table}`);

  const isDataApi =
    setupJson.data_fetching_protocol === "dataapi" ||
    setupJson.data_fetching_protocol === "data-api";

  const basicToken = Buffer.from(
    `${tableConfig.username}:${tableConfig.password}`
  ).toString("base64");

  try {
    while (true) {
      const payload: FetchFmDataRequest = {
        p_key_field: pKeyField,
        p_keys:      pKeys,
        filter:      normalizeFindFilters(filters ?? {}),
        table:       isDataApi ? tableConfig.layout?.trim() || table : table,
        host:        setupJson.host ?? "",
        database:    tableConfig.file ?? "",
        version:     isDataApi ? "vLatest" : "v4",
        data_fetching_protocol: setupJson.data_fetching_protocol ?? "",
        offset,
        limit: pageSize,
      };

      const response = await fetchFmRecord(payload, basicToken);
      fmToken = response.token ?? fmToken;

      const pageData: any[] = response.data || [];
      const returnedCount = pageData.length;

      // First page: learn the total
      if (foundCount === null) {
        foundCount = response.foundCount || 0;
      }

      if (pageData.length > 0) {
        yield pageData;
      }

      // Stop conditions:
      if (foundCount > 0) {
        // DataAPI: we know the exact total
        if (offset + pageSize - 1 >= foundCount) break;
      } else {
        // OData: stop when fewer records returned than requested
        if (returnedCount < pageSize) break;
      }

      if (returnedCount === 0) break; // safety: empty page means done

      offset += pageSize;
    }
  } finally {
    // Always close FM Data API session to free server resources
    if (isDataApi && fmToken) {
      await closeFmSession(
        fmToken,
        setupJson.host ?? "",
        tableConfig.file ?? "",
        "vLatest"
      );
    }
  }
}
```

---

#### 2.2 New Function: `hashMapJoin()`

Replaces the O(n×m) nested-loop join inside the old `stitch()` with O(n+m).

```typescript
/**
 * Joins two record arrays using a pre-built hash map.
 * Time complexity: O(n + m) — linear.
 * Replaces the O(n×m) filter() loop that caused freezes at 50k+ rows.
 *
 * @param primaryRecords  - base dataset records
 * @param joinRecords     - records from the joined table
 * @param sourceField     - field in primaryRecords to join ON
 * @param targetField     - field in joinRecords to match
 * @param joinType        - "inner": drop unmatched; "left": keep unmatched base records
 * @param joinedTableName - prefix applied to joined fields (e.g. "Invoices")
 * @returns               - merged records array
 */
function hashMapJoin(
  primaryRecords: any[],
  joinRecords:    any[],
  sourceField:    string,
  targetField:    string,
  joinType:       "inner" | "left",
  joinedTableName: string
): any[] {
  // Build lookup map from join dataset — O(m)
  const joinMap = new Map<string, any[]>();
  for (const joinRecord of joinRecords) {
    const key = String(joinRecord[targetField] ?? "");
    if (!joinMap.has(key)) joinMap.set(key, []);
    joinMap.get(key)!.push(joinRecord);
  }

  // Match each primary record with O(1) map lookup — O(n)
  const result: any[] = [];
  for (const baseRecord of primaryRecords) {
    const key     = String(baseRecord[sourceField] ?? "");
    const matches = joinMap.get(key);

    if (matches && matches.length > 0) {
      for (const matchRecord of matches) {
        // Prefix all joined fields with "JoinedTableName::" to avoid collisions
        const prefixed: Record<string, any> = {};
        for (const [k, v] of Object.entries(matchRecord)) {
          prefixed[k.startsWith("_") ? k : `${joinedTableName}::${k}`] = v;
        }
        result.push({ ...baseRecord, ...prefixed });
      }
    } else if (joinType === "left") {
      result.push(baseRecord); // left join: retain unmatched base records
    }
    // inner join: silently drops unmatched base records
  }

  return result;
}
```

---

#### 2.3 New Function: `collectRequiredFieldKeys()`

Collects all `{ table, field }` pairs referenced in `report_columns` and `group_by_fields`. Used to project only the needed fields into `row_data`.

```typescript
/**
 * Returns a deduplicated list of all field references needed for this report.
 * Covers: report_columns, group_by main fields, display fields, group_total fields.
 */
function collectRequiredFieldKeys(
  reportStructure: ReportConfigJson
): Array<{ table: string; field: string }> {
  const seen   = new Set<string>();
  const result: Array<{ table: string; field: string }> = [];

  const add = (table: string, field: string) => {
    const key = `${table}.${field}`;
    if (!table || !field || seen.has(key)) return;
    seen.add(key);
    result.push({ table, field });
  };

  for (const col of reportStructure.report_columns ?? []) {
    add(col.table, col.field);
  }
  for (const group of Object.values(reportStructure.group_by_fields ?? {})) {
    add(group.table, group.field);
    for (const d of group.display     ?? []) add(d.table, d.field);
    for (const t of group.group_total ?? []) add(t.table, t.field);
  }

  return result;
}
```

---

#### 2.4 New Function: `stitchPageBatch()`

Takes ONE PAGE of primary records + scoped join datasets, applies all joins via `hashMapJoin`, and returns rows keyed by machine field keys ready for Supabase insertion.

```typescript
/**
 * Stitches one page of primary records with their corresponding join datasets.
 * Uses hashMapJoin (O(n+m)) — NOT nested loops.
 *
 * Output rows use composite machine keys: "TableName.fieldName"
 * e.g. { "SalesOrders.sales_total": 1500, "Invoices.invoice_date": "2025-03-15" }
 *
 * @param primaryBatch      - one FM page (up to 5000 records) from the primary table
 * @param joinDatasets      - Map<fetch_order, records[]> for all joined tables
 * @param reportStructure   - the report config JSON
 * @param mainPrimaryTable  - name of the primary table (fetch_order = 1)
 * @returns                 - stitched rows as { "Table.field": value } objects
 */
function stitchPageBatch(
  primaryBatch:     any[],
  joinDatasets:     Map<number, any[]>,
  reportStructure:  ReportConfigJson,
  mainPrimaryTable: string
): Record<string, any>[] {
  const sortedDefs = [...reportStructure.db_defination]
    .sort((a, b) => a.fetch_order - b.fetch_order);

  // Build relationship index
  const relMap: Record<number, {
    source:      string;
    target:      string;
    joinedTable: string;
    joinType:    "inner" | "left";
  }> = {};
  for (const def of sortedDefs) {
    if (def.joined_table && def.source && def.target) {
      relMap[def.fetch_order] = {
        source:      def.source,
        target:      def.target,
        joinedTable: def.joined_table,
        joinType:    def.join_type?.toLowerCase() === "left" ? "left" : "inner",
      };
    }
  }

  // Start with primary batch, apply each join sequentially
  let resultData: any[] = [...primaryBatch];
  for (let i = 1; i < sortedDefs.length; i++) {
    const def = sortedDefs[i];
    const rel = relMap[def.fetch_order];
    if (!rel) continue;

    resultData = hashMapJoin(
      resultData,
      joinDatasets.get(def.fetch_order) ?? [],
      rel.source,
      rel.target,
      rel.joinType,
      rel.joinedTable
    );
  }

  // Project to only required fields, using "TableName.fieldName" machine keys
  const requiredFields = collectRequiredFieldKeys(reportStructure);

  return resultData.map(record => {
    const row: Record<string, any> = {};
    for (const { table, field } of requiredFields) {
      if (table === "calculated") continue; // calculated fields handled separately

      const isPrimary = table.toLowerCase() === mainPrimaryTable.toLowerCase();
      const rawValue  = isPrimary
        ? record[field]
        : record[`${table}::${field}`];

      row[`${table}.${field}`] = rawValue ?? null;
    }
    return row;
  });
}
```

---

#### 2.5 New Function: `computeSummariesSQL()`

Runs SQL aggregations on `report_session_rows` using Supabase RPCs. Returns `summary_json` that the frontend renders directly without touching raw row data.

```typescript
/**
 * Computes grand summary totals and per-group subtotals via SQL.
 * Never loads raw rows into Node.js memory — all math is done in PostgreSQL.
 *
 * Output shape:
 * {
 *   grand_summary: { "SalesOrders.sales_total": 1250000, ... },
 *   group_summaries: {
 *     "SalesOrders.salesperson": [
 *       { group_value: "John D", row_count: 821, "SalesOrders.sales_total": 320000 },
 *       ...
 *     ]
 *   }
 * }
 *
 * @param templateId  - the report_templates PK
 * @param configJson  - report config (summary_fields, group_by_fields)
 * @param supabase    - admin Supabase client
 */
async function computeSummariesSQL(
  templateId: string,
  configJson: ReportConfigJson,
  supabase:   any
): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  const summaryFields = configJson.summary_fields ?? [];

  // ── Grand Summary ──
  if (summaryFields.length > 0) {
    // summary_fields are stored as "TableName.fieldName" machine keys
    const { data, error } = await supabase.rpc("compute_grand_summary", {
      p_template_id: templateId,
      p_field_keys:  summaryFields,
    });
    if (!error && data) result.grand_summary = data;
  }

  // ── Group Summaries (one per group_by_field entry) ──
  if (configJson.group_by_fields) {
    result.group_summaries = {};

    for (const [, groupDef] of Object.entries(configJson.group_by_fields)) {
      const groupFieldKey  = `${groupDef.table}.${groupDef.field}`;
      const totalFieldKeys = (groupDef.group_total ?? [])
        .map(f => `${f.table}.${f.field}`);

      if (totalFieldKeys.length === 0) continue;

      const { data, error } = await supabase.rpc("compute_group_summary", {
        p_template_id:      templateId,
        p_group_field_key:  groupFieldKey,
        p_total_field_keys: totalFieldKeys,
      });

      if (!error && data) {
        result.group_summaries[groupFieldKey] = data;
      }
    }
  }

  return result;
}
```

---

#### 2.6 New Main Orchestrator: `runReportEngine()`

This is the heart of the new system. It coordinates the paginated FM fetch → hash-map stitch → Supabase insert loop for a given `template_id`.

```typescript
/**
 * Core engine orchestrator.
 *
 * 1. Guards against concurrent generation (checks session_status).
 * 2. Deletes all existing rows for this template.
 * 3. Paginates through FileMaker, stitching and inserting rows batch by batch.
 * 4. Computes SQL-based summaries.
 * 5. Updates report_templates with final status and metadata.
 *
 * Memory profile: only one FM page (≤5000 rows) + its join data held in RAM at a time.
 *
 * @param templateId  - the report_templates UUID
 * @param setupJson   - report setup JSON (tables, credentials, host)
 * @param configJson  - report config JSON (columns, group_by, filters, already merged)
 * @param supabase    - Supabase admin client
 * @param onLog       - callback to push a log message to the SSE stream
 * @returns           { report_structure, summary_json, total_rows }
 */
async function runReportEngine(
  templateId: string,
  setupJson:  ReportSetupJson,
  configJson: ReportConfigJson,
  supabase:   any,
  onLog:      (msg: string) => void
): Promise<{
  report_structure: any[];
  summary_json:     Record<string, any>;
  total_rows:       number;
}> {
  const PAGE_SIZE           = 5000;   // FileMaker max per request
  const SUPABASE_BATCH_SIZE = 500;    // rows per Supabase INSERT call

  const sortedDefs       = [...configJson.db_defination].sort((a, b) => a.fetch_order - b.fetch_order);
  const mainPrimaryTable = sortedDefs[0].primary_table;

  let globalRowIndex = 0;

  // ── Step 1: Concurrent generation guard ──────────────────────────────────────
  // Atomically set status = 'processing' ONLY if it is not already 'processing'.
  // This prevents two users from running the same template simultaneously.
  const { data: lockRow, error: lockError } = await supabase
    .from("report_templates")
    .update({ session_status: "processing" })
    .eq("report_template_id", templateId)
    .neq("session_status", "processing")   // guard: reject if already running
    .select("report_template_id")
    .maybeSingle();

  if (lockError) throw new Error(`Lock error: ${lockError.message}`);
  if (!lockRow) throw new Error("Report generation already in progress for this template. Please wait.");

  onLog("Generation lock acquired. Clearing previous data…");

  // ── Step 2: Delete previous rows for this template ───────────────────────────
  const { error: deleteError } = await supabase
    .from("report_session_rows")
    .delete()
    .eq("template_id", templateId);

  if (deleteError) throw new Error(`Failed to clear previous rows: ${deleteError.message}`);
  onLog("Previous rows cleared.");

  // ── Step 3: Paginated FM fetch + stitch + Supabase insert ────────────────────
  const primaryFilters = buildFilters(
    mainPrimaryTable,
    configJson.filters,
    configJson.date_range_fields
  );

  for await (const primaryPage of fetchAllPagesFromFM(
    mainPrimaryTable,
    setupJson,
    primaryFilters,
    undefined,
    undefined,
    PAGE_SIZE
  )) {
    onLog(`Fetched ${primaryPage.length} records from ${mainPrimaryTable} (rows ${globalRowIndex + 1}–${globalRowIndex + primaryPage.length})`);

    // Fetch join datasets scoped to pkeys in this primary page only
    const joinDatasets = new Map<number, any[]>();

    for (let i = 1; i < sortedDefs.length; i++) {
      const def         = sortedDefs[i];
      const joinedTable = def.joined_table!;
      const sourceField = def.source!;

      const pkeys = extractPkeysFromData(primaryPage, sourceField);

      if (pkeys.length === 0) {
        onLog(`No pkeys from ${sourceField} for join to ${joinedTable}. Skipping.`);
        joinDatasets.set(def.fetch_order, []);
        continue;
      }

      onLog(`Fetching ${joinedTable} for ${pkeys.length} pkeys…`);
      const joinRows: any[] = [];
      const joinFilters = buildFilters(joinedTable, configJson.filters, configJson.date_range_fields);

      for await (const joinPage of fetchAllPagesFromFM(
        joinedTable,
        setupJson,
        joinFilters,
        def.target,
        pkeys,
        PAGE_SIZE
      )) {
        joinRows.push(...joinPage);
      }

      onLog(`  → ${joinRows.length} rows from ${joinedTable}`);
      joinDatasets.set(def.fetch_order, joinRows);
    }

    // Hash-map stitch — O(n+m), not O(n×m)
    const stitchedRows = stitchPageBatch(
      primaryPage,
      joinDatasets,
      configJson,
      mainPrimaryTable
    );

    onLog(`Stitched ${stitchedRows.length} rows. Writing to Supabase…`);

    // Bulk insert in chunks of SUPABASE_BATCH_SIZE
    const insertPayload = stitchedRows.map((row, i) => ({
      template_id: templateId,
      row_index:   globalRowIndex + i,
      row_data:    row,
    }));

    for (let start = 0; start < insertPayload.length; start += SUPABASE_BATCH_SIZE) {
      const chunk = insertPayload.slice(start, start + SUPABASE_BATCH_SIZE);
      const { error } = await supabase.from("report_session_rows").insert(chunk);
      if (error) throw new Error(`Row insert failed: ${error.message}`);
    }

    globalRowIndex += stitchedRows.length;
    onLog(`✅ ${globalRowIndex} total rows written.`);
  }

  // ── Step 4: SQL aggregations ──────────────────────────────────────────────────
  onLog("Computing summaries via SQL…");
  const summary_json = await computeSummariesSQL(templateId, configJson, supabase);

  // ── Step 5: Generate layout structure (no body rows) ─────────────────────────
  const report_structure = generateReportStructureMetadata(configJson, setupJson, globalRowIndex);

  // ── Step 6: Mark template ready ───────────────────────────────────────────────
  await supabase
    .from("report_templates")
    .update({
      session_status:            "ready",
      session_total_rows:        globalRowIndex,
      session_summary_json:      summary_json,
      session_report_structure:  report_structure,
      session_last_generated_at: new Date().toISOString(),
    })
    .eq("report_template_id", templateId);

  onLog(`✅ Engine complete. Total rows: ${globalRowIndex}`);

  return { report_structure, summary_json, total_rows: globalRowIndex };
}
```

---

#### 2.7 New Function: `generateReportStructureMetadata()`

Modified version of the existing `generateReportStructure()`. Produces the same `TitleHeader`, `Subsummary`, `Body` (field order only), `TrailingGrandSummary` — but **omits `BodyData`**. Body rows are fetched on-demand via pagination.

```typescript
// Signature — no stitchResult needed:
function generateReportStructureMetadata(
  reportStructure: ReportConfigJson,
  setupJson:       ReportSetupJson,
  totalRows:       number
): any[] {
  // Identical logic to the current generateReportStructure() EXCEPT:
  // 1. Remove any BodyData population from the Body section
  // 2. Add a SessionMeta entry at the end:
  result.push({
    SessionMeta: {
      totalRows,
      sessionBased: true,          // tells frontend to use pagination API
      pageSize:     100,           // suggested page size for frontend
    }
  });
  return result;
}
```

---

#### 2.8 New POST Handler (replaces existing)

```typescript
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const { report_setup, report_config, template_id } = body;

    // Validate with existing Zod schemas (reportSetupSchema, reportConfigSchema)
    // ... (same validation as before)

    const logs: string[] = [];
    const onLog = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    };

    let report_structure: any[];
    let summary_json: Record<string, any>;
    let total_rows: number;

    try {
      ({ report_structure, summary_json, total_rows } = await runReportEngine(
        template_id,
        setupJson,
        configJson,
        supabase,
        onLog
      ));
    } catch (engineError) {
      // Mark template as failed so the guard is released
      await supabase
        .from("report_templates")
        .update({ session_status: "failed" })
        .eq("report_template_id", template_id);
      throw engineError;
    }

    return NextResponse.json({
      status:               "ok",
      template_id,
      report_structure_json: report_structure,
      summary_json,
      total_rows,
      processing_logs:      logs,
    }, {
      status:  200,
      headers: { "Access-Control-Allow-Origin": "*" },
    });

  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      detail: error.message,
    }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}
```

---

### PHASE 3 — New Paginated Row Fetch API

**New file:** `src/app/api/report-sessions/[template_id]/rows/route.ts`

```typescript
/**
 * GET /api/report-sessions/[template_id]/rows?page=1&limit=100
 *
 * Returns a paginated slice of report_session_rows for a template.
 * Row data uses machine field keys — frontend resolves labels from setupJson.
 *
 * Response shape:
 * {
 *   rows:       [{ "SalesOrders.sales_total": 1500, ... }, ...],
 *   page:       1,
 *   limit:      100,
 *   total_rows: 50000,
 *   has_more:   true
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
  const { template_id } = await params;
  const searchParams = req.nextUrl.searchParams;
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit = Math.min(500, parseInt(searchParams.get("limit") ?? "100")); // hard cap: 500

  const session = await getSession();
  if (!session?.companyId) return new Response("Unauthorized", { status: 401 });

  const supabase = createAdminClient();

  // Verify template belongs to this company and rows are ready
  const { data: template, error: tmplError } = await supabase
    .from("report_templates")
    .select("report_template_id, session_status, session_total_rows, company_id")
    .eq("report_template_id", template_id)
    .eq("company_id", session.companyId)
    .single();

  if (tmplError || !template) return new Response("Not found", { status: 404 });

  if (template.session_status !== "ready") {
    return NextResponse.json({ status: template.session_status }, { status: 202 });
  }

  const offset = (page - 1) * limit;

  const { data: rows, error: rowsError } = await supabase
    .from("report_session_rows")
    .select("row_data")
    .eq("template_id", template_id)
    .order("row_index", { ascending: true })
    .range(offset, offset + limit - 1);

  if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 });

  const totalRows = template.session_total_rows ?? 0;

  return NextResponse.json({
    rows:       rows?.map(r => r.row_data) ?? [],
    page,
    limit,
    total_rows: totalRows,
    has_more:   offset + limit < totalRows,
  });
}
```

---

### PHASE 4 — Update Stream Route (`stream/route.ts`)

**File:** `src/app/api/templates/[template_id]/generate/stream/route.ts`

The SSE structure stays identical. Only the payload sent to the engine changes and what is extracted from the response.

#### 4.1 Pass `template_id` to the engine

```typescript
// BEFORE (line 148-152):
const engineRes = await fetch(`${baseUrl}/api/generate-report`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ report_setup: setupJson, report_config: configJson }),
});

// AFTER — add template_id:
const engineRes = await fetch(`${baseUrl}/api/generate-report`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    report_setup:  setupJson,
    report_config: configJson,
    template_id,              // ← NEW: engine needs this to key report_session_rows
  }),
});
```

#### 4.2 Extract new response fields

```typescript
// BEFORE (line 160-168):
const report_structure_json = sanitizeJsonForPostgres(engineResult.report_structure_json);
const stitch_result = engineResult.stitch_result ?? null;

// AFTER:
const report_structure_json = sanitizeJsonForPostgres(engineResult.report_structure_json);
const summary_json           = engineResult.summary_json  ?? {};
const total_rows             = engineResult.total_rows    ?? 0;
// NOTE: stitch_result is GONE — rows live in report_session_rows now
```

#### 4.3 Update `reports` insert (user generate flow)

```typescript
// AFTER — no stitch_result, no full body in report_data_json:
const { data: saved } = await supabase
  .from("reports")
  .insert({
    company_id:              session.companyId,
    report_template_id:      template_id,
    report_name:             reportHeading,
    report_config_json:      persistedConfigJson,
    report_data_json:        report_structure_json,  // layout structure only (no body rows)
    generated_by_user_id:    generatedByUserId,
  })
  .select("report_id")
  .single();
```

#### 4.4 Update SSE `done` event

```typescript
// BEFORE:
enqueue(sseEvent("done", {
  report_structure_json,
  stitch_result,
  report_name: reportHeading,
  report_id:   savedRecordId,
}));

// AFTER:
enqueue(sseEvent("done", {
  report_structure_json,    // layout metadata (field order, subsummary defs)
  summary_json,             // pre-computed SQL totals
  total_rows,               // for pagination UI
  template_id,              // frontend uses this to call /api/report-sessions/[template_id]/rows
  report_name: reportHeading,
  report_id:   savedRecordId,
}));
```

---

### PHASE 5 — Update Frontend Page (`page.tsx`)

**File:** `src/app/[company_slug]/templates/[template_id]/generate/page.tsx`

#### 5.1 Replace state variables

```typescript
// REMOVE:
const [reportData, setReportData] = useState<any[] | null>(null);

// ADD:
const [reportStructure,  setReportStructure]  = useState<any[] | null>(null);
const [summaryJson,      setSummaryJson]       = useState<Record<string, any> | null>(null);
const [totalRows,        setTotalRows]         = useState<number>(0);
const [currentPage,      setCurrentPage]       = useState<number>(1);
const [pageRows,         setPageRows]          = useState<any[]>([]);
const [isLoadingRows,    setIsLoadingRows]     = useState(false);
const PAGE_SIZE = 100;
```

#### 5.2 New function: `loadRowsPage()`

```typescript
const loadRowsPage = useCallback(async (tid: string, page: number) => {
  setIsLoadingRows(true);
  try {
    const res = await apiClient.get<{
      rows:       any[];
      total_rows: number;
      has_more:   boolean;
    }>(`/api/report-sessions/${tid}/rows?page=${page}&limit=${PAGE_SIZE}`);

    setPageRows(res.rows ?? []);
    setCurrentPage(page);
  } catch {
    addToast("error", "Error", "Failed to load report rows.");
  } finally {
    setIsLoadingRows(false);
  }
}, [addToast]);
```

#### 5.3 Update SSE `done` handler

```typescript
// BEFORE:
} else if (event.type === "done") {
  const structured = event.report_structure_json;
  setReportData(structured);
  dispatch({ type: "SET_REPORT_PREVIEW", payload: structured });
  const rows = extractBodyRows(structured);
  setChartRows(rows);
}

// AFTER:
} else if (event.type === "done") {
  const structured = event.report_structure_json;
  const summary    = event.summary_json;
  const total      = event.total_rows;
  const tid        = event.template_id;

  setReportStructure(structured);
  setSummaryJson(summary);
  setTotalRows(total);
  setCurrentPage(1);
  dispatch({ type: "SET_REPORT_PREVIEW", payload: structured });

  // Load first page of body rows
  await loadRowsPage(tid, 1);
  fetchChartSchemas();

  addToast("success", "Report Generated",
    `"${event.report_name}" — ${total.toLocaleString()} rows`);
}
```

#### 5.4 Add pagination controls to the render

```tsx
{/* Pagination bar — shown when report has session-based rows */}
{totalRows > PAGE_SIZE && (
  <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-100">
    <button
      disabled={currentPage === 1 || isLoadingRows}
      onClick={() => loadRowsPage(templateId, currentPage - 1)}
    >
      Previous
    </button>
    <span className="text-xs text-slate-500">
      Rows {((currentPage - 1) * PAGE_SIZE) + 1}–
      {Math.min(currentPage * PAGE_SIZE, totalRows)} of {totalRows.toLocaleString()}
    </span>
    <button
      disabled={currentPage * PAGE_SIZE >= totalRows || isLoadingRows}
      onClick={() => loadRowsPage(templateId, currentPage + 1)}
    >
      Next
    </button>
  </div>
)}
```

---

### PHASE 6 — Update `DynamicReportPreview` Component

**File:** `src/components/DynamicReportPreview.tsx`

The component currently reads `BodyData` from inside `report_structure_json`. With the new architecture, body rows are passed as a separate prop.

New props interface:

```typescript
interface DynamicReportProps {
  reportStructure: any[];                              // layout metadata only
  summaryJson:     Record<string, any> | null;         // pre-computed SQL summaries
  bodyRows:        Record<string, any>[];              // current page — field key format
  fieldLabelMap:   Record<string, Record<string, string>>; // table→field→label lookup
  currentPage:     number;
  totalRows:       number;
  pageSize:        number;
  onPageChange:    (page: number) => void;
  isLoadingRows:   boolean;
}
```

**Label resolution inside the component:**
```typescript
// When rendering a body cell:
const label = fieldLabelMap[table]?.[field] ?? field;
const value = row[`${table}.${field}`] ?? "--";
```

**Summary rendering:**
```typescript
// Grand summary row
const grandTotal = summaryJson?.grand_summary ?? {};
// e.g. grandTotal["SalesOrders.sales_total"] = 1250000

// Group summary
const groupData = summaryJson?.group_summaries?.["SalesOrders.salesperson"] ?? [];
// e.g. [{ group_value: "John D", "SalesOrders.sales_total": 320000 }, ...]
```

---

## 6. FIELD KEY CONVENTION (CRITICAL — READ THIS)

All data in `report_session_rows.row_data` uses **dot-notation machine keys**:

```
"TableName.fieldName"
```

| What | Example |
|---|---|
| Key stored in DB | `"SalesOrders.sales_total"` |
| Value | `1500.00` |
| Label (display only) | `"Sales Total ($)"` — from `setupJson.tables.SalesOrders.fields.sales_total.label` |
| SQL aggregation | `SUM((row_data->>'SalesOrders.sales_total')::numeric)` |

**Label resolution is ALWAYS done at render time. Labels are NEVER stored in `row_data`.**

---

## 7. BACKWARD COMPATIBILITY

- Old `reports` records that have full body data in `report_data_json` continue to work — they have no `SessionMeta` in the structure so the frontend renders them the legacy way.
- New reports have `SessionMeta.sessionBased = true` in `report_structure_json` — the frontend detects this and uses the pagination API instead.
- Frontend detection:
  ```typescript
  const isSessionBased = reportStructure?.some(
    (item: any) => item?.SessionMeta?.sessionBased === true
  );
  ```

---

## 8. EXECUTION ORDER (DO THIS IN ORDER)

```
Step 1:  Run SQL migration → CREATE TABLE report_session_rows
Step 2:  Run SQL migration → ALTER TABLE report_templates (add 5 session_ columns)
Step 3:  Run SQL migration → CREATE FUNCTION compute_grand_summary
Step 4:  Run SQL migration → CREATE FUNCTION compute_group_summary
Step 5:  Update utility.ts → add offset/limit to FetchFmDataRequest + fetchFmRecord()
Step 6:  Rewrite generate-report/route.ts:
           - Add fetchAllPagesFromFM()
           - Add hashMapJoin()
           - Add collectRequiredFieldKeys()
           - Add stitchPageBatch()
           - Add computeSummariesSQL()
           - Add generateReportStructureMetadata()
           - Add runReportEngine()
           - Replace POST handler
Step 7:  Create /api/report-sessions/[template_id]/rows/route.ts
Step 8:  Update stream/route.ts:
           - Pass template_id to engine
           - Extract summary_json + total_rows from response
           - Update SSE done event payload
           - Update reports insert (no stitch_result)
Step 9:  Update page.tsx:
           - Replace reportData state with reportStructure + summaryJson + pagination state
           - Add loadRowsPage()
           - Update SSE done handler
           - Add pagination controls UI
Step 10: Update DynamicReportPreview.tsx:
           - New props interface
           - Label resolution from fieldLabelMap
           - summaryJson-driven grand/group totals
Step 11: Test small dataset (< 100 rows) end-to-end
Step 12: Test 50k+ rows — verify no OOM, pagination works, summaries correct
```

---

## 9. FILES MODIFIED / CREATED SUMMARY

| File | Change Type | Description |
|---|---|---|
| `src/lib/utils/utility.ts` | MODIFY | Add `offset`, `limit` to interface + function |
| `src/app/api/generate-report/route.ts` | REWRITE | Full new engine |
| `src/app/api/templates/[template_id]/generate/stream/route.ts` | MODIFY | Pass `template_id`, use new response fields |
| `src/app/api/report-sessions/[template_id]/rows/route.ts` | NEW | Paginated row fetch |
| `src/app/[company_slug]/templates/[template_id]/generate/page.tsx` | MODIFY | New state + pagination |
| `src/components/DynamicReportPreview.tsx` | MODIFY | New props, label resolution |
| `src/lib/DataManager.ts` | DEPRECATE | Keep file, mark as deprecated |
| `supabase/migrations/0XX_report_session_rows.sql` | NEW | Table DDL + indexes |
| `supabase/migrations/0XX_report_templates_session_columns.sql` | NEW | 5 new columns |
| `supabase/migrations/0XX_report_session_rpcs.sql` | NEW | RPC functions |

---

## 10. EDGE CASES & CONSTRAINTS

### OData Protocol
- Does not return `foundCount`. `fetchAllPagesFromFM()` detects `foundCount === 0` and uses `returnedCount < pageSize` as stop signal.
- OData batch requests do not support offset/limit — for pkey-scoped fetches they are already bounded by the pkeys list, so no pagination needed on joined tables.

### Custom Calculated Fields (HyperFormula)
- `calculateCustomFields()` currently runs in-memory on the full `bodyFields` array.
- In the new architecture: run HyperFormula per batch inside `stitchPageBatch()` before inserting to Supabase.
- Calculated field results stored in `row_data` using key `"calculated.field_name"`.

### Concurrent Generation Guard
- `runReportEngine()` uses a conditional Supabase UPDATE with `.neq("session_status", "processing")` to atomically acquire the lock.
- If two users try to generate simultaneously, the second one gets: `"Report generation already in progress for this template."`.
- On engine error, status is set to `"failed"` (not stuck at `"processing"`).

### Vercel Timeout
- Current `maxDuration = 300` seconds. At 50k rows (10 FM pages of 5000) + Supabase inserts, expected runtime ~30–90 seconds. Well within limits.
- If future datasets exceed this, `runReportEngine()` can be extracted to a Supabase Edge Function invoked asynchronously, with the frontend polling `session_status` on `report_templates`.

### `report_session_rows` Table Growth
- Each regen deletes ALL rows for the template before inserting new ones. No accumulation.
- On `report_templates` deletion, `ON DELETE CASCADE` removes all `report_session_rows` for that template automatically.

---

## 11. TESTING PLAN

| Test | What to Verify |
|---|---|
| Unit: `hashMapJoin()` | Inner join, left join, no matches, duplicate keys in join set |
| Unit: `fetchAllPagesFromFM()` | Mock FM returning foundCount=12000 → exactly 3 pages yielded |
| Unit: `stitchPageBatch()` | Single table, 2-table inner join, 2-table left join |
| Unit: `collectRequiredFieldKeys()` | Deduplication, calculated fields excluded |
| SQL: `compute_grand_summary` | Insert test rows, call RPC, verify SUM matches |
| SQL: `compute_group_summary` | Insert rows for 2 groups, verify per-group totals |
| Integration: small dataset | < 100 FM records → verify `report_session_rows` count matches |
| Integration: 50k rows | Full pipeline → no OOM, correct total_rows, pagination returns correct slices |
| Concurrent guard | Trigger two simultaneous generates → second must be rejected with clear error |
| Backward compat | Load legacy saved report (no SessionMeta) → renders from `report_data_json` |
| Regen cycle | Generate twice → verify row count stays correct (no duplicates) |
