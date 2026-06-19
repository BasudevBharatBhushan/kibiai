# P-012 — Report Generation: Supabase Migration & AI Report Configurator

**Ticket:** T-012  
**Scope:** `fullstack`  
**Status:** PENDING APPROVAL

---

## 0. Context & Guiding Principles

### What Already Works (Keep It)
| Asset | Location | Status |
|---|---|---|
| Data fetch engine | `lib/utils/utility.ts` — fetchFmRecord, stitch, generateReportStructure | ✅ Keep as-is |
| Report generation API | `app/api/generate-report/route.ts` | ✅ Keep, minor adaptations |
| AI Chatbot | `components/chat/ModularChatbot.tsx` | ✅ Keep as-is |
| Report Configurator (right panel) | `components/ReportConfigurator.tsx` + `components/report-builder/*` | ✅ Keep, rebind to Supabase |
| Dynamic Report Preview | `components/DynamicReportPreview.tsx` | ✅ Keep as-is |
| Setup Wizard | `components/setup/SetupWizard.tsx` | ✅ Already saving to Supabase |
| apiClient | `utils/apiClient.ts` | ✅ Must be used for ALL frontend fetches |
| Supabase clients | `utils/supabase/server.ts` — createClient + createAdminClient | ✅ Use in all API routes |
| Auth | `utils/auth.ts` — getSession() | ✅ Must be called at top of every API route |

### What Changes
| Change | Rationale |
|---|---|
| Remove FileMaker as metadata store | Move config R/W to Supabase report_templates table |
| New Supabase-backed API routes | /api/templates/[id]/config — read/write config_json and conversation_id |
| New Report Generation API route | /api/templates/[id]/generate — run engine, save result to reports table |
| New Configurator page | [company_slug]/templates/[template_id]/configurator |
| New Generate page | [company_slug]/templates/[template_id]/generate |
| Smart Navigation flow | Template list → smart CTA → Setup (if needed) → Configurator → Generate |
| ReportContext migration | fmRecordId → templateId; add LOAD_FULL_REPORT variant for Supabase |

### Mandatory Standards from Docs (ALL Must Be Applied)
| Standard | Source | Applies To |
|---|---|---|
| ALL frontend components MUST use `apiClient` (never raw fetch) | frontend-structure.md | Every new frontend component |
| ALL API routes MUST call `getSession()` for auth | backend-structure.md | Every new API route |
| ALL API routes MUST scope by `company_id` | backend-structure.md | Every new API route |
| ALL API routes MUST use `createAdminClient()` for Supabase ops | backend-structure.md | Every new API route |
| ALL API routes MUST use Zod or explicit validation | backend-structure.md | Every new API route |
| API response format MUST be `{ success: boolean, data?, error? }` | backend-structure.md | Every new API route |
| ALL components MUST implement skeleton-based loading states | frontend-structure.md | Every new component |
| ALL pages MUST use `PageContainer` for X-axis alignment | frontend-structure.md | Every new page |
| Primary buttons/highlights MUST use Legacy Blue `#2563eb` | frontend-structure.md | Every new component |

---

## 1. Folder Structure Changes

### New Routes to Create
```
src/app/[company_slug]/templates/[template_id]/
  setup/page.tsx           EXISTS
  configurator/page.tsx    CREATE  AI Builder + Configurator
  generate/page.tsx        CREATE  Runtime filters + Generate + Save
```

### New API Routes to Create
```
src/app/api/
  templates/
    [template_id]/
      config/route.ts      CREATE  GET config_json + setup_json from Supabase
                                   POST saves config_json + conversation_id
      generate/route.ts    CREATE  POST runs engine, saves to reports table
  reports/
    [report_id]/route.ts   CREATE  GET a saved report by ID
```

### Existing Routes to Adapt
```
src/app/api/generate-report/route.ts    Keep — engine is called with body (no FM record ID needed)
src/app/api/filemaker-report/route.ts   Keep for legacy /reports page support
src/app/api/report-config/route.ts      Superseded by /api/templates/[id]/config
```

### Components to Create
```
src/components/report-configurator/
  ConfiguratorPage.tsx       Three-panel layout (Chat + Preview + Controls)
  ConfiguratorHeader.tsx     Save, version, JSON controls
  ReportPreviewPanel.tsx     Wraps DynamicReportPreview with Supabase data

src/components/report-generator/
  GeneratePage.tsx           Runtime filters form + Generate button
  RuntimeFiltersForm.tsx     Date range + field filters applied per-run
  GeneratedReportView.tsx    Report output + Export PDF/Excel + Save to history
```

> **Note on folder placement:** Per `frontend-structure.md`, feature-specific complex components go under `components/features/`. However, since the existing ReportConfigurator and report-builder components live directly under `src/components/`, we maintain consistency and place new components in `src/components/report-configurator/` and `src/components/report-generator/` to match the established pattern.

---

## 2. Database (Supabase)

### Tables Used — All Already Exist

**report_templates**
- report_template_id (uuid PK)
- report_template_setup_json (jsonb) — written by SetupWizard ✅ DONE
- report_template_config_json (jsonb) — written by Configurator 🆕 NEW
- report_template_data_json (jsonb) — preview snapshot 🆕 NEW
- conversation_id (varchar) — OpenAI thread ID
- version_number (int) — incremented on each config save
- report_template_status (varchar)
- updated_on (timestamptz)

**reports**
- report_id (uuid PK)
- company_id (uuid FK)
- report_template_id (uuid FK)
- report_name (varchar)
- report_config_json (jsonb) — config snapshot at generation time
- report_data_json (jsonb) — generated report data (immutable)
- report_insight (text)
- generated_by_user_id (uuid FK)
- created_on (timestamptz)

### No New Migrations Needed for Phase 1
All required columns already exist in the Supabase schema.

---

## 3. Navigation Flow

### Smart CTA on Template List
Each template row evaluates its state:

```
hasSetup  = report_template_setup_json IS NOT NULL
hasConfig = report_template_config_json IS NOT NULL

Primary CTA:
  if (!hasSetup)  -> "Setup Required" [orange]  -> /setup
  if (hasSetup && !hasConfig) -> "Configure" [Legacy Blue #2563eb] -> /configurator
  if (hasSetup && hasConfig)  -> "Generate Report" [green] -> /generate

Secondary CTA (always visible):
  Settings gear -> /setup
  Configure icon -> /configurator (disabled tooltip if no setup)
```

### Full User Journey
```
Template List
  [Setup Needed]  -> /setup  ->  [Complete Setup CTA]  -> /configurator
  [Setup Done]    -> /configurator
                       AI Chat: user prompts -> AI returns config_json
                       Right Panel: edit columns, filters, groups
                       Center: Live Preview
                       [Save Config] -> Supabase (via apiClient)
                       [Generate Report] -> /generate
  /generate
      Runtime Filters Form (skeleton while loading config)
      [Run Report] -> /api/templates/[id]/generate (via apiClient)
      Report Output -> DynamicReportPreview
      [Save to History] / [Export PDF] / [Export Excel]
```

---

## 4. Implementation Steps

---

### STEP 1 — Supabase Template Config API
**File:** `src/app/api/templates/[template_id]/config/route.ts`

**Requirements checklist:**
- [ ] Call `getSession()` — return 401 if no session
- [ ] Validate `template_id` as UUID (Zod or explicit check)
- [ ] Use `createAdminClient()` for DB operations
- [ ] Scope all queries by `company_id` from session
- [ ] Response format: `{ success: boolean, data?, error? }`
- [ ] Wrap in try/catch, return 500 on unexpected error

**GET** — Fetch config and setup from Supabase:
```typescript
// Fetch: report_template_setup_json, report_template_config_json,
//        conversation_id, version_number
// Scope: WHERE report_template_id = ? AND company_id = session.companyId
```

Response shape:
```json
{
  "success": true,
  "data": {
    "template_id": "uuid",
    "setup_json": { ... },
    "config_json": { ... } | null,
    "conversation_id": "thread_xxx" | null,
    "version_number": 3,
    "has_setup": true,
    "has_config": true
  }
}
```

**POST** — Save config to Supabase:
```typescript
// Body (Zod validated):
// { config_json?, conversation_id?, bump_version?, preview_data_json? }
// UPDATE report_templates SET
//   report_template_config_json = config_json,
//   conversation_id = conversation_id,
//   report_template_data_json = preview_data_json,
//   version_number = version_number + 1 (if bump_version),
//   updated_on = NOW()
// WHERE report_template_id = ? AND company_id = ?
```

Response shape:
```json
{ "success": true, "data": { "version_number": 4, "updated_on": "..." } }
```

---

### STEP 2 — Report Generation API (Supabase-backed)
**File:** `src/app/api/templates/[template_id]/generate/route.ts`

**Requirements checklist:**
- [ ] Call `getSession()` — return 401 if no session
- [ ] Validate body with Zod (`runtime_filters`, `report_name`, `save_to_history`)
- [ ] Use `createAdminClient()` for DB reads/writes
- [ ] Scope all DB queries by `company_id`
- [ ] Response format: `{ success: boolean, data?, error? }`
- [ ] Wrap entire handler in try/catch

**POST** logic:
1. `getSession()` — 401 if missing
2. Fetch `setup_json` and `config_json` from `report_templates` via `createAdminClient()`
3. Return 400 if either is missing
4. Merge `runtime_filters` into config (deep merge — do NOT persist runtime filters)
5. Call `processFetchOrder` + `stitch` + `generateReportStructure` from `lib/utils/utility.ts`
6. If `save_to_history = true`:
   - INSERT into `reports` table: `{ company_id, report_template_id, report_name, report_config_json, report_data_json, generated_by_user_id }`
7. Return `{ success: true, data: { report_structure_json, report_id? } }`

---

### STEP 3 — Reports History API
**File:** `src/app/api/reports/[report_id]/route.ts`

**GET** — Fetch a saved report by ID:
- `getSession()` — 401 if no session
- Scope by `company_id`
- Return `{ success: true, data: { report_id, report_name, report_data_json, report_config_json, created_on } }`

---

### STEP 4 — Templates List API — Add Status Flags
**File:** `src/app/api/company/templates/route.ts` (existing)

Add computed boolean flags to SELECT:
```sql
(report_template_setup_json IS NOT NULL) AS has_setup,
(report_template_config_json IS NOT NULL) AS has_config
```

These are returned as lightweight boolean flags — do NOT return the full JSON blobs in the list view (performance).

---

### STEP 5 — Template List Page — Smart CTA
**File:** `src/app/[company_slug]/templates/page.tsx` (existing)

Changes:
- Read `has_setup` and `has_config` from each template object.
- Replace static Settings icon with smart CTA buttons:

```tsx
// Primary action button (per row):
if (!hasSetup)             -> <Link href="/setup">   [orange]      "Setup"
if (hasSetup && !hasConfig) -> <Link href="/configurator"> [blue]  "Configure"
if (hasSetup && hasConfig)  -> <Link href="/generate"> [green]      "Generate"

// Secondary icons (always):
Settings gear -> /setup
```

- All `fetch` calls MUST use `apiClient` instead of raw `fetch`.
- Skeleton loader: already implemented (keep existing pattern).
- Legacy Blue `#2563eb` for the "Configure" CTA button.

---

### STEP 6 — Setup Wizard — "Continue to Configure" CTA
**File:** `src/components/setup/SetupWizard.tsx` (existing)

After setup JSON is successfully saved:
- Show a prominent **"Continue to Configure Report →"** button styled in Legacy Blue `#2563eb`.
- Use Next.js `Link` (not raw anchor), navigating to `/${slug}/templates/${templateId}/configurator`.
- This button appears at the bottom of the final setup step, not a modal — inline in the wizard flow.

---

### STEP 7 — ReportContext Migration
**File:** `src/context/ReportContext.tsx` (existing)

**Current state shape:**
```typescript
interface ReportState {
  config: ReportConfig;
  setup: ReportSetup | null;
  fmRecordId: string | null;   // ← REPLACE
  isLoading: boolean;
  reportPreview: any | null;
}
```

**New state shape:**
```typescript
interface ReportState {
  config: ReportConfig;
  setup: ReportSetup | null;
  templateId: string | null;   // ← Supabase UUID (was fmRecordId)
  conversationId: string | null; // ← NEW — OpenAI thread ID
  isLoading: boolean;
  reportPreview: any | null;
}
```

**Action changes:**
- Replace `LOAD_FULL_REPORT` payload: `{ config, setup, fmRecordId }` → `{ config, setup, templateId, conversationId }`
- Add new action: `SET_CONVERSATION_ID` — updates `conversationId` in state
- Keep ALL other existing actions unchanged

**Reducer changes:**
- `LOAD_FULL_REPORT`: set `templateId` instead of `fmRecordId`, set `conversationId`
- `SET_CONVERSATION_ID`: `{ ...state, conversationId: action.payload }`

> ⚠️ The existing `report-builder` sub-components only read `state.config` and `state.setup` — they do NOT use `fmRecordId` directly. So this rename is safe and isolated.

---

### STEP 8 — ReportConfigurator Save Handler Migration
**File:** `src/components/ReportConfigurator.tsx` (existing)

**Current save flow (uses raw fetch):**
```
handleUpdate → raw fetch /api/generate-report → raw fetch /api/report-config (FileMaker)
```

**New save flow (uses apiClient):**
```
handleUpdate → apiClient.post('/api/generate-report', { report_setup, report_config })
             → apiClient.post(`/api/templates/${templateId}/config`, { config_json, bump_version: true, preview_data_json })
```

**Key changes:**
1. Replace all `fetch(...)` calls with `apiClient.post(...)`.
2. Replace `state.fmRecordId` with `state.templateId`.
3. Pass `state.setup` and `state.config` directly to `generate-report` (no FM record ID needed — the engine is body-driven).
4. Save config to `/api/templates/${templateId}/config` instead of `/api/report-config`.
5. Keep all existing error handling and toast notifications.

---

### STEP 9 — Configurator Page Route
**File:** `src/app/[company_slug]/templates/[template_id]/configurator/page.tsx`

**Requirements checklist:**
- [ ] Use `PageContainer` for X-axis alignment (max-width 1600px)
- [ ] Skeleton loader while fetching config from API
- [ ] Use `apiClient.get(...)` (never raw fetch)
- [ ] Set breadcrumbs via `useHeader()` context
- [ ] Guard: if `has_setup = false`, redirect to `/setup` with toast message
- [ ] Guard: if `has_config = false`, show empty config state (still allow AI chat to generate first config)

**Three-panel layout:**
```
┌────────────────────────────────────────────────────────────────────────┐
│  SubHeader: Template Name | Version Badge | [Save Config] [Generate]   │
├──────────────────┬─────────────────────────┬──────────────────────────┤
│  LEFT (25%)      │  CENTER (45%)            │  RIGHT (30%)             │
│  AI Chat         │  Live Preview            │  Configurator Controls   │
│  ModularChatbot  │  DynamicReportPreview    │  ReportConfigurator      │
│                  │  (skeleton while loading)│  (existing component)    │
└──────────────────┴─────────────────────────┴──────────────────────────┘
```

**Data Flow:**
1. On mount: `apiClient.get('/api/templates/[id]/config')` → load `setup_json`, `config_json`, `conversation_id`.
2. Dispatch `LOAD_FULL_REPORT` (with new `templateId` + `conversationId` payload) into `ReportContext`.
3. `ModularChatbot` receives `setup_json` as system context.
4. AI response handler: parse config_json from AI response → dispatch `LOAD_INITIAL_CONFIG`.
5. Conversation ID change handler: dispatch `SET_CONVERSATION_ID` + `apiClient.post('/api/templates/[id]/config', { conversation_id })`.
6. [Save Config] button: `apiClient.post('/api/templates/[id]/config', { config_json, bump_version: true })`.
7. [Generate Report] button: `router.push('/generate')`.

**Skeleton pattern (per `frontend-structure.md`):**
```tsx
if (isLoading) return (
  <div className="animate-pulse">
    <div className="h-10 w-64 bg-slate-100 rounded-xl mb-4" />
    <div className="grid grid-cols-3 gap-4 h-[80vh]">
      <div className="bg-slate-50 rounded-2xl" />
      <div className="bg-slate-50 rounded-2xl" />
      <div className="bg-slate-50 rounded-2xl" />
    </div>
  </div>
);
```

---

### STEP 10 — ConfiguratorPage Component
**File:** `src/components/report-configurator/ConfiguratorPage.tsx`

- Houses the three-panel layout logic.
- Receives: `templateId`, `companySlug`.
- Manages: loading state, config fetch, AI response bridging.
- Wraps `ReportProvider` context (so all report-builder sub-components work unchanged).
- Uses Legacy Blue `#2563eb` for Save Config button, green for Generate Report button.

---

### STEP 11 — Generate Page Route
**File:** `src/app/[company_slug]/templates/[template_id]/generate/page.tsx`

**Requirements checklist:**
- [ ] Use `PageContainer` for X-axis alignment
- [ ] Skeleton loader while fetching config
- [ ] Use `apiClient.get/post` (never raw fetch)
- [ ] Set breadcrumbs via `useHeader()`
- [ ] Guard: if no config, redirect to `/configurator` with message

**Layout:**
```
SubHeader: "[Template Name] — Generate Report" | [Back to Configurator]
├── RUNTIME FILTERS SECTION (collapsible card)
│     Date Range Fields (derived from config_json.date_range_fields)
│     Field Filters (derived from config_json.filters)
│     Report Name input (auto-filled: "{template_name} - {date}")
│     [Run Report]   [Reset Filters]
└── REPORT OUTPUT (appears after generation)
      DynamicReportPreview (skeleton while generating)
      [Save to History]  [Export PDF]  [Export Excel]
```

**Logic:**
1. On mount: `apiClient.get('/api/templates/[id]/config')` → derive filter form schema.
2. Build `RuntimeFiltersForm` dynamically from `config_json.date_range_fields` and `config_json.filters`.
3. On **Run Report**: `apiClient.post('/api/templates/[id]/generate', { runtime_filters, report_name, save_to_history: false })`.
4. Display returned `report_structure_json` in `DynamicReportPreview`.
5. On **Save to History**: call same endpoint with `save_to_history: true` → show success toast.

---

### STEP 12 — GeneratePage Component
**File:** `src/components/report-generator/GeneratePage.tsx`

- Houses generate page layout.
- Skeleton while fetching config from API.
- Legacy Blue for Run Report button.

---

### STEP 13 — RuntimeFiltersForm Component
**File:** `src/components/report-generator/RuntimeFiltersForm.tsx`

Receives `configJson` and `setupJson`. Renders:
- A date-range input for each key in `config_json.date_range_fields` (using current date range as default placeholder).
- A text/select field for each key in `config_json.filters`.
- Calls `onFiltersChange(filters)` on change.

```typescript
interface RuntimeFiltersFormProps {
  configJson: ReportConfigJson;
  setupJson: ReportSetupJson;
  onFiltersChange: (filters: RuntimeFilters) => void;
}
```

---

### STEP 14 — GeneratedReportView Component
**File:** `src/components/report-generator/GeneratedReportView.tsx`

Receives `reportStructureJson` and `reportName`. Renders:
- `DynamicReportPreview` component.
- Export buttons: PDF and Excel (hook into existing export logic from old reports page).
- Save to History button.

---

### STEP 15 — Conversation ID Sync (Supabase, not FileMaker)
**File:** `src/components/report-configurator/ConfiguratorPage.tsx`

The `handleConversationIdChange` callback:
```typescript
// OLD (FileMaker):
await fetch('/api/filemaker-report/thread', { ... })

// NEW (Supabase via apiClient):
await apiClient.post(`/api/templates/${templateId}/config`, {
  conversation_id: threadId
});
dispatch({ type: 'SET_CONVERSATION_ID', payload: threadId });
```

---

## 5. Detailed Gaps Addressed (from Structure Docs)

| Gap | Root Cause | Fix Applied |
|---|---|---|
| Raw `fetch()` in new components | frontend-structure.md mandates `apiClient` | All new components use `apiClient.get/post` |
| Missing `getSession()` in API routes | backend-structure.md: all routes must auth | Added to every new route (Step 1-3) |
| Missing company_id scoping | backend-structure.md: every entity must be scoped | All DB queries filtered by `session.companyId` |
| `createAdminClient()` not used | backend-structure.md: use for bypass-RLS ops | All API routes use `createAdminClient()` |
| Missing Zod validation | backend-structure.md: validate all inputs | All POST bodies validated with Zod |
| Wrong response format | backend-structure.md: `{ success, data?, error? }` | All API responses use this format |
| Missing skeleton loaders | frontend-structure.md: EVERY component needs skeleton | All 6 new components implement skeleton states |
| Missing PageContainer | frontend-structure.md: EVERY page must use it | Both new page routes wrap with PageContainer |
| Legacy Blue not specified | frontend-structure.md: primary buttons use `#2563eb` | All primary CTAs use `#2563eb` |
| `fmRecordId` left in ReportContext | Needs to become `templateId` for Supabase | Explicit migration plan in Step 7 |
| `LOAD_FULL_REPORT` action payload | Still references `fmRecordId` in payload shape | Updated action payload in Step 7 |
| Raw `fetch` in ReportConfigurator | Existing file uses raw fetch | Migrated to apiClient in Step 8 |
| Conversation ID synced to FileMaker | Old code: `/api/filemaker-report/thread` | Redirected to Supabase via apiClient in Step 15 |

---

## 6. Execution Order

| # | Step | Files | Risk |
|---|---|---|---|
| 1 | Create /api/templates/[id]/config route | New file | Low |
| 2 | Create /api/templates/[id]/generate route | New file | Medium |
| 3 | Create /api/reports/[report_id] route | New file | Low |
| 4 | Modify templates list API (add has_setup/has_config) | Existing route | Low |
| 5 | Modify templates list page (Smart CTA + apiClient) | Existing page | Low |
| 6 | Add "Continue to Configure" CTA to SetupWizard | Existing component | Low |
| 7 | Migrate ReportContext (fmRecordId → templateId + conversationId) | Existing context | Medium |
| 8 | Migrate ReportConfigurator save handler (raw fetch → apiClient + Supabase) | Existing component | Medium |
| 9 | Create ConfiguratorPage component | New component | Medium |
| 10 | Create Configurator page route | New page | Medium |
| 11 | Create GeneratePage + RuntimeFiltersForm + GeneratedReportView | New components | Medium |
| 12 | Create Generate page route | New page | Medium |
| 13 | ESLint + Build check | — | — |

---

## 7. Files NOT to Touch

```
src/lib/utils/utility.ts                 Core engine — DO NOT MODIFY
src/app/api/generate-report/route.ts     Core engine route — DO NOT MODIFY
src/components/DynamicReportPreview.tsx  Renderer — DO NOT MODIFY
src/components/chat/ModularChatbot.tsx   AI chat — DO NOT MODIFY
src/components/report-builder/*          All configurator sections — DO NOT MODIFY
src/components/DynamicReport.tsx         Existing report component — DO NOT MODIFY
```

---

## 8. Success Criteria

- [ ] Template list shows smart CTAs based on has_setup / has_config state
- [ ] Template list uses apiClient (not raw fetch)
- [ ] Setup page shows "Continue to Configurator" after setup is saved
- [ ] Configurator page loads setup_json and config_json from Supabase
- [ ] Configurator page has skeleton loader while fetching
- [ ] AI Chat generates config_json and updates the right panel
- [ ] Save Config persists config_json and bumps version_number in Supabase
- [ ] Conversation ID is persisted to Supabase (not FileMaker)
- [ ] Generate Report navigates to /generate
- [ ] Generate page has skeleton loader while fetching config
- [ ] Generate page allows runtime filters dynamically derived from config_json
- [ ] Generated report renders in DynamicReportPreview
- [ ] Save to History persists to reports table in Supabase
- [ ] All new API routes verify session with getSession()
- [ ] All new API routes scope by company_id
- [ ] All new API routes use createAdminClient()
- [ ] All new API routes validate input with Zod
- [ ] All new API responses use { success, data?, error? } format
- [ ] All new components implement skeleton loading states
- [ ] All new pages use PageContainer
- [ ] Primary CTAs use Legacy Blue #2563eb
- [ ] ReportContext.fmRecordId replaced by templateId
- [ ] ReportConfigurator uses apiClient not raw fetch
- [ ] All existing engine logic (stitch, fetchFmRecord) is unchanged
- [ ] npm run lint passes
- [ ] npm run build passes
