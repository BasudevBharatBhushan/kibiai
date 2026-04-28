# P-015 — Chart Generation: Supabase Migration

**Ticket:** T-015 | **Scope:** `fullstack` | **Status:** PENDING APPROVAL
**Depends On:** P-012 (Report Generation) must be COMPLETED first

---

## 1. Overview (Simple Description)

The goal of this ticket is to migrate our chart-building system from the legacy FileMaker backend to our modern Supabase database. 

**How it works in plain English:**
1. **Building Charts**: A user goes to their Report Template and opens the "Chart Builder". Here, they chat with our AI assistant to design multiple charts (like bar charts, pie charts, etc.) and arrange them on a dashboard. The AI uses the template's preview data to show what the charts will look like. The chat history is saved directly on the Report Template, so if the user comes back tomorrow, the AI remembers the conversation.
2. **Viewing Charts**: Later, when a business user generates a real Report (with live data) and saves it to their history, they can click "Open Charts". This opens a read-only viewer. The system automatically takes the chart designs created on the template and fills them with the specific, frozen data from the saved report.

---

## 2. Architectural Shift

Based on recent feedback, the architecture for Chart Generation has been refined:
- **Chart Templates are bound to Report Templates**, not individual saved Reports.
- **One Report Template** can have **Multiple Chart Templates** (each representing a single chart widget).
- The AI conversation thread for building these charts is stored on the **Report Template** as `chart_conversation_id`.
- **Chart Builder** is accessed via the Report Template and uses the template's preview dataset (`report_template_data_json`).
- **Chart Viewer** is accessed via a Saved Report and uses the report's frozen dataset (`report_data_json`), applying the associated Chart Templates.

Lifecycle:
`Report Template` -> `Chart Template Builder` (AI generates multiple `Chart Templates`) -> `Generate Report` -> `Saved Report` -> `View Charts` (Renders the `Chart Templates` using the `Saved Report` data).

---

## 3. Database Schema Changes

### SQL Migration needed:
Add a field to `report_templates` to store the thread ID for the chart builder AI.

```sql
ALTER TABLE report_templates
  ADD COLUMN IF NOT EXISTS chart_conversation_id varchar(120);
COMMENT ON COLUMN report_templates.chart_conversation_id IS 'AI thread ID for the Chart Builder session associated with this template.';
```

*Note: We DO NOT add `report_id` to `chart_templates` because Chart Templates belong to Report Templates.*

---

## 4. Folder Structure & Routes

### New UI Routes
```
src/app/[company_slug]/
  templates/[template_id]/charts/
    page.tsx                            CREATE  Chart Builder (AI Chat + Dashboard Grid)
  reports/
    page.tsx                            CREATE  Report History list
    [report_id]/charts/
      page.tsx                          CREATE  Chart Viewer (Dashboard Grid only, no AI)
```

### New API Routes
```
src/app/api/
  report-templates/[template_id]/
    charts/
      route.ts                          CREATE  GET (list charts) / POST (create chart)
    charts/canvas-batch/
      route.ts                          CREATE  PATCH (batch update canvas states)
    chart-thread/
      route.ts                          CREATE  PATCH (save chart_conversation_id)
  chart-templates/[chart_template_id]/
    route.ts                            CREATE  PATCH (update setup_json) / DELETE
  reports/
    route.ts                            CREATE  GET list of saved reports
    [report_id]/
      route.ts                          CREATE  GET report + linked chart templates
```

---

## 5. Updating the Integrated Chatbot

The existing `ModularChatbot` needs to be updated to support the new Supabase flow.
- **Context Awareness**: The chatbot must receive the `chart_conversation_id` from the Report Template, not the old FileMaker record ID.
- **Saving Charts**: When the AI outputs a chart configuration, the frontend action (`persistChartToSupabase`) must POST to `/api/report-templates/[template_id]/charts` to create a new `chart_templates` row, instead of appending to an array in FileMaker.
- **Thread Sync**: When a new conversation thread is started, the chatbot action must trigger a PATCH to `/api/report-templates/[template_id]/chart-thread` to persist the new `chart_conversation_id`.
- **Decoupling**: Ensure `ModularChatbot` is ONLY rendered in the "Chart Builder" route (`/templates/[template_id]/charts`), and completely excluded from the read-only "Chart Viewer" route.

---

## 6. Mandatory Principles (Frontend & Backend)

**Frontend Standards (Must Follow):**
- **Skeleton Loaders**: Every new component (Chart Builder, Report History, Chart Viewer) MUST implement a skeleton-based loader state (`isLoading`). No empty "Loading..." texts.
- **API Fetching**: ALL frontend API calls MUST use the `apiClient` wrapper. No raw `fetch` allowed.
- **PageContainer**: Every new page route MUST wrap its main content in the `<PageContainer>` component to maintain global X-axis alignment.
- **Legacy Blue Theme**: Use `#2563eb` (`blue-600`) for primary buttons and CTAs (e.g., the `[Open Charts]` button).

**Backend Standards (Must Follow):**
- **Authorization**: ALL new API routes must start with `getSession()` to verify the user. Return 401 if unauthorized.
- **Data Scoping**: Every database query MUST include a `WHERE company_id = ?` clause to ensure strict multi-tenant isolation.
- **Admin Client**: Use `createAdminClient()` for all DB operations to bypass RLS, safely contained inside the server-side API handler.
- **Validation**: Use Zod or strict explicit checks for all incoming POST/PATCH request bodies.
- **Response Format**: Every API response MUST follow the standard structure: `{ success: boolean, data?: any, error?: string }`. Wrap handlers in `try/catch`.

---

## 7. Implementation Steps

### STEP 1 — Database Migration
Create `ai-workspace/sql/015-add-chart-conv-id.sql` and run `ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS chart_conversation_id varchar(120);`

### STEP 2 — Update ChartTypes
Update `src/lib/charts/ChartTypes.ts` to replace `fmRecordId` with `supabaseId`.

### STEP 3 — Chart Template APIs
Create all API routes under `/api/report-templates/[template_id]/...` and `/api/chart-templates/...` following the backend standards (Zod, `company_id` scoping, `apiClient` structure).

### STEP 4 — Reports APIs
Create `/api/reports/route.ts` and `/api/reports/[report_id]/route.ts`. 

### STEP 5 — Update DashboardContext
Modify `src/context/DashboardContext.tsx`:
- Add an `isViewerMode` boolean prop.
- Update `saveDashboardState` to use the new `/canvas-batch` Supabase endpoint.

### STEP 6 — Chart Builder Route
Implement `src/app/[company_slug]/templates/[template_id]/charts/page.tsx`:
- Wrap in `PageContainer`.
- Implement `isLoading` skeleton.
- Fetch `report_template_data_json`.
- Integrate `ModularChatbot` passing the `chart_conversation_id`.

### STEP 7 — Report History Route
Implement `src/app/[company_slug]/reports/page.tsx`:
- List all saved reports with a "Legacy Blue" styled `[Open Charts]` CTA.
- Use `PageContainer` and a skeleton table loader.

### STEP 8 — Chart Viewer Route
Implement `src/app/[company_slug]/reports/[report_id]/charts/page.tsx`:
- Read-only dashboard (`isViewerMode=true`). No Chatbot rendered.
- Fetch frozen `report_data_json` and apply chart templates.

### STEP 9 — ESLint & Build Check
Ensure `npm run lint` and `npm run build` pass without errors before completion.

---

## 8. Success Criteria

- [ ] `chart_conversation_id` added to `report_templates`.
- [ ] Simple English overview is clear.
- [ ] Chart Builder works directly on Report Templates.
- [ ] Chart Viewer works on Saved Reports (read-only, frozen data).
- [ ] `ModularChatbot` correctly persists new thread IDs and chart configs to Supabase.
- [ ] All new components use `PageContainer` and Skeleton Loaders.
- [ ] All API routes use `apiClient`, check session, and scope by `company_id`.
- [ ] Build and Lint pass.
