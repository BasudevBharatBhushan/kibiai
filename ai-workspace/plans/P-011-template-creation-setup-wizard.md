# P-011 — Template Creation & Setup Wizard
**Ticket**: T-011  
**Scope**: `fullstack`  
**Status**: AWAITING APPROVAL

---

## Overview

This plan implements KiBiAI's core entry point: the **Template Creation flow** and the **Setup Wizard** (PAGE 3 + PAGE 5 per the application document). The wizard produces a `setup_json` stored in `report_templates.report_template_setup_json`, which is the schema context the AI reads for every report prompt.

```
Templates Page → Create Template Modal → Setup Wizard Page → Save Setup JSON
```

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| FileMaker layout/field fetch | New API routes proxied through Next.js `/api/filemaker/setup/*` | Security: never expose credentials to client; reuse existing FileMaker auth pattern |
| Setup JSON structure | Exact match to spec (host, data_fetching_protocol, tables, relationships) | AI reads this directly; any deviation breaks prompts |
| Template creation | Supabase `report_templates` with status=`Draft`, setup_json=`{}` initially | Standard lifecycle |
| Protocols | Both `data-api` AND `o-data-api` fully enabled — FileMaker supports both today | No protocol is disabled; future scope is OTHER db types (PostgreSQL, Supabase, etc.) |
| Database source | FileMaker only currently — "Add New Database" section is FileMaker-specific | Other DB connectors planned for future but not in scope now |
| Module list | Fetched from Supabase `modules` table for company | Dynamic, not hardcoded |
| State management | React `useState` + `useReducer` for complex setup JSON state | No new libraries |

---

## Subtask Breakdown

---

### SUBTASK 1 — SQL Migration: `report_templates` + `modules` verification
**Type**: Backend (SQL)  
**File**: `ai-workspace/sql/011_verify_report_templates_modules.sql`

Verify `report_templates` and `modules` tables exist with all required columns per the DB schema doc. Add any missing columns. Add RLS policies: company users can only CRUD their own templates.

---

### SUBTASK 2 — API Route: Create Template Draft
**Type**: Backend  
**File**: `src/app/api/company/templates/route.ts`

#### Endpoints
```
POST /api/company/templates
```

**Request Body**:
```json
{
  "company_id": "uuid",
  "module_id": "uuid",
  "report_template_name": "string",
  "created_by_user_id": "uuid"
}
```

**Logic**: Insert into `report_templates` with `report_template_status = 'Draft'`, `report_template_setup_json = '{}'`, `version_number = 1`. Return new template record.

---

### SUBTASK 3 — API Route: Fetch Modules for Company
**Type**: Backend  
**File**: `src/app/api/company/modules/route.ts`

```
GET /api/company/modules?company_id=uuid
```

Returns `{ modules: [{ module_id, module_name, module_code }] }` filtered by company_id and `module_status = 'Active'`.

---

### SUBTASK 4 — API Routes: FileMaker Setup Utilities (Server-Side Proxy)
**Type**: Backend  
**Files**:
- `src/app/api/filemaker/setup/layouts/route.ts`
- `src/app/api/filemaker/setup/fields/route.ts`

#### `POST /api/filemaker/setup/layouts`
Fetches all layouts from a FileMaker database. Credentials forwarded via `Authorization: Basic` header.

**Request Body**: `{ host, database, protocol }`  
**Logic**: Call FileMaker Data API `GET /fmi/data/vLatest/databases/{database}/layouts`. Flatten folder layouts (`isFolder` + `folderLayoutNames`). Return `{ layouts: [{ name, table }] }`.

#### `POST /api/filemaker/setup/fields`
Fetches field metadata for a specific layout.

**Request Body**: `{ host, database, layout, protocol }`  
**Authorization Header**: `Basic base64(username:password)`

**Logic**:
1. Authenticate with FileMaker Data API (`POST /databases/{database}/sessions`)
2. Call `GET /databases/{database}/layouts/{layout}` to get `fieldMetaData`
3. Map `result` type: `number→number`, `date/timestamp→date`, `*→text`
4. Return `{ fields: [{ name, type }] }`

---

### SUBTASK 5 — API Route: Save Setup JSON
**Type**: Backend  
**File**: `src/app/api/company/templates/[template_id]/setup/route.ts`

```
PUT /api/company/templates/{template_id}/setup
```

**Request Body**: `{ setup_json: { host, data_fetching_protocol, tables, relationships } }`

**Logic**: Validate required keys exist. Update `report_templates.report_template_setup_json` and `updated_on`. Return updated template.

---

### SUBTASK 6 — Template Creation Modal + Templates Page Update
**Type**: Frontend  
**Files**:
- `src/app/[company_slug]/templates/page.tsx` (UPDATE — wire "Create New Template" card to open modal)
- `src/components/templates/CreateTemplateModal.tsx` (CREATE)

#### CreateTemplateModal
Premium modal with:
1. **Template Name** — text input, auto-focused on open, required
2. **Module** — dropdown from `GET /api/company/modules?company_id=...`
3. **Create** button → `POST /api/company/templates` → navigate to `/{slug}/templates/{id}/setup`

UX: loading state, inline validation, close on Escape/backdrop, error display.

---

### SUBTASK 7 — Setup Wizard Page + All Sub-components
**Type**: Frontend  
**Files**:
- `src/app/[company_slug]/templates/[template_id]/setup/page.tsx` (CREATE)
- `src/components/setup/SetupWizard.tsx` (CREATE — main state container)
- `src/components/setup/HostConfigSection.tsx` (CREATE)
- `src/components/setup/AddDatabaseSection.tsx` (CREATE)
- `src/components/setup/TableCard.tsx` (CREATE)
- `src/components/setup/RelationshipsPanel.tsx` (CREATE)
- `src/components/setup/SetupJsonPreview.tsx` (CREATE)
- `src/components/setup/ODataFieldModal.tsx` (CREATE)

#### Page Route
```
/[company_slug]/templates/[template_id]/setup
```

#### State Shape (mirrors JSON spec exactly)
```ts
interface SetupConfig {
  host: string;
  data_fetching_protocol: 'data-api' | 'o-data-api';
  tables: Record<string, TableConfig>;
  relationships: Relationship[];
}
interface TableConfig {
  file: string; username: string; password: string; layout: string;
  fields: Record<string, FieldConfig>;
}
interface FieldConfig {
  type: 'text' | 'number' | 'date';
  label: string;
  prefix?: string; suffix?: string; valuelist?: string;
}
interface Relationship {
  primary_table: string; joined_table: string; source: string; target: string;
}
```

#### Section: Host Configuration
- Host input (text)
- Protocol select: `data-api` | `o-data-api` — **both fully enabled for FileMaker**
- When protocol changes to `o-data-api`, the Layout select row is hidden (OData does not use layouts — uses field selection modal instead)
- Collapsible

#### Section: Add New Database
- Database File, Username, Password inputs
- **Fetch Tables** button → `POST /api/filemaker/setup/layouts` (data-api) OR `POST /api/filemaker/setup/odata-metadata` (o-data-api) → populates Table dropdown
- **data-api flow**: Table select → Layout select → `+ Add Table` → fetches field metadata → adds to `configData.tables`
- **o-data-api flow**: Table select → opens ODataFieldModal (checkbox list of fields) → user confirms → table added
- Max 5 tables guard + duplicate guard
- Layout row shown/hidden based on selected protocol
- Loading spinners + status toasts (auto-dismiss 5s)

#### Section: Database Configuration
For each table: collapsible card, editable File/TableName/Layout/Username/Password, field table with editable Label/Prefix/Suffix/ValueList per field, delete field (╳) and delete table buttons.  
- Empty prefix/suffix/valuelist stripped from JSON on save.
- Table rename updates relationship references.

#### Sidebar: Relationships Panel
- "+ Add" button (requires ≥2 tables)
- Each card: Primary Table, Joined Table, Source Field, Target Field (all selects), Delete button
- Field dropdowns auto-populate from selected table's fields

#### Floating Action: Save Setup
- Fixed bottom-right "💾 Save Setup" button
- Strips empty optional fields before saving
- Calls `PUT /api/company/templates/{template_id}/setup`
- Success toast on completion

#### JSON Preview Panel (sidebar)
- Expandable "View Raw JSON" section showing live `JSON.stringify(configData, null, 2)`

---

### SUBTASK 8 — agents.md Updates + Execution Log
**Type**: Documentation  
- Update `src/app/[company_slug]/agents.md` with new routes and component map
- Create `ai-workspace/execution-logs/L-011-template-creation-setup-wizard.md`

---

## File Change Summary

| File | Action |
|---|---|
| `ai-workspace/sql/011_verify_templates_modules.sql` | CREATE |
| `src/app/api/company/templates/route.ts` | CREATE |
| `src/app/api/company/modules/route.ts` | CREATE |
| `src/app/api/filemaker/setup/layouts/route.ts` | CREATE |
| `src/app/api/filemaker/setup/fields/route.ts` | CREATE |
| `src/app/api/company/templates/[template_id]/setup/route.ts` | CREATE |
| `src/app/[company_slug]/templates/page.tsx` | UPDATE |
| `src/components/templates/CreateTemplateModal.tsx` | CREATE |
| `src/app/[company_slug]/templates/[template_id]/setup/page.tsx` | CREATE |
| `src/components/setup/SetupWizard.tsx` | CREATE |
| `src/components/setup/HostConfigSection.tsx` | CREATE |
| `src/components/setup/AddDatabaseSection.tsx` | CREATE |
| `src/components/setup/TableCard.tsx` | CREATE |
| `src/components/setup/RelationshipsPanel.tsx` | CREATE |
| `src/components/setup/SetupJsonPreview.tsx` | CREATE |
| `src/components/setup/ODataFieldModal.tsx` | CREATE |
| `src/app/[company_slug]/agents.md` | UPDATE |
| `ai-workspace/execution-logs/L-011-template-creation-setup-wizard.md` | CREATE |

---

## Execution Order

```
SUBTASK 1 → SQL verification (schema safety)
SUBTASK 2 → Create Template API
SUBTASK 3 → Modules API
SUBTASK 4 → FileMaker Setup Proxy APIs (layouts + fields)
SUBTASK 5 → Save Setup API
SUBTASK 6 → CreateTemplateModal + Templates page update
SUBTASK 7 → Full Setup Wizard + all sub-components
SUBTASK 8 → Documentation
```

---

> **APPROVAL REQUIRED** — Waiting for explicit "Proceed" or "Approved" before any code is written.
