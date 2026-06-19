# T-016 — Access Control & Dual-View Architecture

## Status: `COMPLETED`

## Scope: `fullstack`

## Priority: `CRITICAL`

## Summary

Implement a comprehensive role-based access control (RBAC) context system and a dual-view architecture (Admin/Superadmin View vs. User View) for the company workspace. This includes:

1. **AccessControlContext** — A new React context that loads the logged-in user's role, permissions (module access + template permissions), and exposes helper utilities (`can()`, `isAdmin`, `isSuperAdmin`).
2. **Dual-View Routing** — Admin/Superadmin users default to an admin-level template list with AI operations (modify/create/delete template, analyze charts). Users default to a user-level template list with generate report + generate chart actions.
3. **Permission Gating** — Disabled (not hidden) UI for actions the user doesn't have access to. Templates/modules filtered by assigned access.
4. **User-Level Report + Chart Generation Screen** — Simplified report generation (heading, filters, date range) with side-by-side chart display for users who have `can_generate_chart` permission.
5. **Saved Reports & Charts Viewer** — Display previously generated reports with their linked charts (1:N).
6. **Template List UX Overhaul** — Remove action buttons, add single arrow icon for navigation, add report template preview pane on selection.
7. **Cross-page Navigation** — From Report Configurator ↔ Setup ↔ Charts with navigation controls.
8. **Admin Dashboard Visibility** — Only Superadmins see the "Admin Dashboard" nav item.

## DB Changes Required

- Add `can_generate_charts` column to `user_template_permissions` (rename from `can_create_charts` for consistency with user-level action naming).
- Extend `/api/auth/me` to return `role_id`, `is_super_admin`, `module_access[]`, `template_permissions[]`.

## Affected Areas

### Frontend
- `src/context/AccessControlContext.tsx` (NEW)
- `src/app/[company_slug]/templates/page.tsx` (MAJOR REWRITE — dual view)
- `src/app/[company_slug]/templates/[template_id]/generate/page.tsx` (MAJOR — chart panel)
- `src/components/layout/Header.tsx` (Admin Dashboard visibility gate)
- `src/components/providers/CompanyProvider.tsx` (extend with user identity)

### Backend
- `src/app/api/auth/me/route.ts` (extend payload)
- `src/app/api/company/templates/permissions/route.ts` (add `can_generate_charts`)
- New: `src/app/api/user/permissions/route.ts` (single endpoint to get all permissions for logged-in user)

### Database
- `ai-workspace/sql/016_access_control_permissions.sql`

## Dependencies
- T-015 (Chart Generation Supabase Migration) — chart_templates and charts tables must exist.

## Acceptance Criteria
- [ ] Superadmin users land on admin-level template view by default
- [ ] Admin users (non-super) land on admin view but restricted actions are disabled (not hidden)
- [ ] Regular users land on user view with no option to switch to admin view
- [ ] Template list shows only modules/templates the user has access to
- [ ] Single arrow icon on template list navigates smartly (setup if missing, else configurator for admin, generate for user)
- [ ] Template preview panel appears on the right when a template is selected
- [ ] Report generation screen shows charts to the right (if user has chart access)
- [ ] Saved reports are viewable with their associated charts
- [ ] Admin Dashboard nav visible only to Superadmins
- [ ] No chatbot on user-level report generation screen
