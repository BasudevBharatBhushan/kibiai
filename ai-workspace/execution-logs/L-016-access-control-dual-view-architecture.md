# L-016 — Access Control & Dual-View Architecture
## Execution Log

**Ticket**: T-016  
**Plan**: P-016  
**Date**: 2026-04-29  
**Status**: ✅ COMPLETED

---

## Phase 1: Database & Backend Foundation

### Step 1.1 — SQL Migration ✅
**File**: `ai-workspace/sql/016_access_control_permissions.sql`
- Renamed `can_create_charts` → `can_generate_charts` in `user_template_permissions`
- Added `can_analyze_charts` (admin-level AI chart analysis permission)
- **⚠️ ACTION REQUIRED**: Run this migration in Supabase before deploying

### Step 1.2 — New API: `/api/user/permissions` ✅
**File**: `src/app/api/user/permissions/route.ts`
- Returns complete permission profile: role, module_access[], template_permissions[]
- Superadmins receive full-access payload automatically (no DB query shortcut)
- Regular users: queries `user_module_access` + `user_template_permissions`

### Step 1.3 — Extended `/api/auth/me` ✅
**File**: `src/app/api/auth/me/route.ts`
- Added `user_id`, `role_id`, `is_super_admin`, `company_id` to response
- Now queries `roles` join for `is_super_admin` flag

### Step 1.4 — Updated Template Permissions API ✅
**File**: `src/app/api/company/templates/permissions/route.ts`
- Renamed `can_create_charts` → `can_generate_charts` in GET response + PUT upsert
- Added `can_analyze_charts` to both GET and PUT

---

## Phase 2: Access Control Context

### Step 2.1 — `AccessControlContext` ✅
**File**: `src/context/AccessControlContext.tsx`
- Full type definitions: `PermissionAction`, `ModuleAccess`, `TemplatePermission`, `UserRole`
- `can(action, templateId?)` helper with superadmin bypass
- `hasModuleAccess(moduleId)` helper
- `activeView` state with `setActiveView` (admin-only guard)
- All functions wrapped in `useCallback` / `useMemo` to prevent infinite loops

### Step 2.2 — Company Layout Updated ✅
**File**: `src/app/[company_slug]/layout.tsx`
- `AccessControlProvider` added inside `CompanyProvider`, outside `HeaderProvider`

---

## Phase 3: Template List Dual View

### Step 3.1 — Templates Page Rewrite ✅
**File**: `src/app/[company_slug]/templates/page.tsx`
- Admin view: shows all templates, setup/configurator navigation
- User view: shows only templates with `can_generate_report = true`
- `ViewToggle` pill for admin/superadmin users
- Single `ChevronRight` icon per row (replaces multiple action buttons)
- Disabled (not hidden) arrow for restricted templates in admin view

### Step 3.2 — Template Preview Panel ✅
**File**: `src/components/templates/TemplatePreviewPanel.tsx`
- Slides in on the right when a template row is clicked
- Renders mini preview of `report_template_data_json`
- Supports array/sections/rows/key-value data shapes

### Step 3.3 — Single Arrow Navigation ✅
- Admin view: Setup (if !has_setup) → Configurator (if has_setup)
- User view: → Generate page always

---

## Phase 4: User-Level Generate Page

### Step 4.1 — Generate Page Rewrite ✅
**File**: `src/app/[company_slug]/templates/[template_id]/generate/page.tsx`
- No chatbot on this screen
- Charts panel on the right (only if `can("generate_charts", templateId)`)
- Charts auto-load after save via `/api/reports/{reportId}/charts`
- `TemplateNavBar` for cross-page navigation

### Step 4.2 — TemplateNavBar Component ✅
**File**: `src/components/templates/TemplateNavBar.tsx`
- Context-aware nav for: setup / configurator / generate / charts pages
- Back links on left, forward links (colored) on right

---

## Phase 5: Saved Reports

### Step 5.1 — Report Detail Page ✅
**File**: `src/app/[company_slug]/reports/[report_id]/page.tsx`
- Left: Full report preview (read-only via ReportPreview)
- Right: All linked charts from `/api/reports/{report_id}/charts`
- Back nav, report metadata, link to chart builder

---

## Phase 6: Header & Navigation Gating

### Step 6.1 — Admin Dashboard Superadmin-Only ✅
**File**: `src/components/layout/Header.tsx`
- Imported `useAccessControl`
- `{isSuperAdmin && <Link>Admin Dashboard</Link>}` in both desktop nav and mobile drawer

---

## Build Verification

```
✅ npm run build — Exit code 0
✅ TypeScript — No type errors
✅ All 36 routes compiled successfully
```

---

## Outstanding Actions Required

1. **DATABASE MIGRATION**: Run `ai-workspace/sql/016_access_control_permissions.sql` in Supabase
2. The `/api/reports/{report_id}` endpoint (for report detail page) — verify it returns `report_data_json` field
3. Test with a real Superadmin user to verify `isSuperAdmin = true` from `roles.is_super_admin`
