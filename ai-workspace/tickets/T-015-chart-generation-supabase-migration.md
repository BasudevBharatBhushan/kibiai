# Ticket: T-015 — Chart Generation Supabase Migration

**Status:** PENDING APPROVAL
**Scope:** `fullstack`
**Depends On:** P-012 (Report Generation)

## Objective
Migrate the legacy FileMaker-based chart generation system to native Supabase. Ensure charts are built at the **Report Template** level, and then rendered statically for specific **Saved Reports**.

## Key Requirements
1. **Database Update:** Add `chart_conversation_id` to `report_templates` to persist the AI chat thread used when building charts.
2. **Chart Builder Route:** Implement `/templates/[template_id]/charts` where users can chat with AI to generate multiple chart widgets (saved as `chart_templates`).
3. **Report History Route:** Implement `/reports` to view saved reports.
4. **Chart Viewer Route:** Implement `/reports/[report_id]/charts` to view the generated charts using the frozen `report_data_json`. This view must strictly follow the chart templates and be read-only (no AI chat).
5. **Context Refactor:** Update `DashboardContext` to handle Supabase IDs and support a clean `isViewerMode` flag.

## Reference
- **Implementation Plan:** `ai-workspace/plans/P-015-chart-generation-supabase-migration.md`
- **Architecture Doc:** `ai-workspace/docs/appilcation_document/application_document.txt`

## Tasks
- [ ] Run SQL migration for `chart_conversation_id`.
- [ ] Create API routes for managing chart templates and canvas states.
- [ ] Update frontend Types and Contexts to remove FileMaker references.
- [ ] Build the Chart Builder UI (Template-level).
- [ ] Build the Report History and Chart Viewer UI (Report-level).
- [ ] Verify ESLint and Next.js Build pass.
