# T-017 — UX Overhaul: Generate Page, Navigation, Template Preview & Admin Permissions Grouping

**Status:** TODO
**Scope:** fullstack
**Priority:** HIGH (item #3 is Major Critical)

---

## Problem Statements

### 1. Template List — Persistent Preview Panel (Medium)
- The `TemplatePreviewPanel` (right drawer) only appears on row click.
- It should always be visible as a persistent right panel.
- The preview content should render the actual report (same `DynamicReportPreview` as configurator) from saved `preview_data_json`, not just a JSON snapshot.

### 2. Template-level Navigation via Breadcrumb (Medium)
- Current breadcrumbs show `Templates / Template Name / Screen` — this is not user-friendly.
- New pattern:
  - **Breadcrumb row**: `Report Templates` → `Setup` → `Report Builder` → `Chart Builder`
  - **Below breadcrumb**: Display selected template name as a professional subtitle
  - Clicking each breadcrumb step navigates to that screen for the active template
  - This replaces the current `TemplateNavBar` component approach

### 3. User Generate Page — Major Critical Overhaul (Critical)
Full rebuild of `[template_id]/generate/page.tsx`:
- **Always-available filters**: Show filter/date-range inputs even if none defined in config — let users add ad-hoc filters
- **Date range UX**: Replace plain text input with a professional dual-calendar date range picker
- **Collapsible config panel**: Report configuration section should be a collapsible left panel
- **Auto-generate report on right**: When "Generate" is clicked, the `DynamicReportPreview` renders on the right side automatically
- **Auto-generate charts**: After report generation, automatically fetch chart templates for this report template and render charts using the generated report data
- **Chart panel**: Expandable/collapsible chart section below or beside the report
- **Save to history**: Save both the report AND its charts to Supabase `reports` table
- **Load saved reports**: Show a list of previously saved reports the user can select and reload (report + charts)

### 4. Admin Permissions UI — Grouping (Low)
- In `admin/page.tsx` Column 4 (Permissions panel), group the 6 toggles into two labeled sections:
  - **Admin / Superadmin Level**: Modify Templates (AI), Create Templates (AI), Delete Templates, Analyze Charts (AI)
  - **User Level**: Generate Reports, Generate Charts

---

## Out of Scope
- Database schema changes beyond what's needed for saving report+chart history
- Configurator page changes
- Platform admin changes
