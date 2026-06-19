# P-009: Company Admin Workspace Implementation

This plan outlines the steps to build the Company Admin Workspace.

## Phase 1: Database Schema & Security
- [x] Create `user_module_access` table (`user_id`, `module_id`, `company_id`).
- [x] Create `user_template_permissions` table (`user_id`, `report_template_id`, `company_id`).
- [x] Enforce Row Level Security (RLS) using the `company_id` isolation logic.
- [x] Create SQL migration script and apply to Supabase.

## Phase 2: Backend API Routes
- [x] **Staff API**: Implement `/api/company/staff`.
- [x] **Modules Access API**: Implement `/api/company/modules/access`.
- [x] **Template Permissions API**: Implement `/api/company/templates/permissions`.

## Phase 3: Frontend Layout
- [x] Define the Page Route: `src/app/[company_slug]/admin/page.tsx`.
- [x] Build the three-column layout (Staff Directory, Module/Template Selection, Permissions).

## Phase 4: Integration & Polish
- [x] Connect UI to API routes.
- [x] Apply premium styling.
- [x] Perform `npm run lint` and `npm run build`.

## References
- `ai-workspace/docs/appilcation_document/application_document.txt`
- `ai-workspace/docs/db-architecture.md`
