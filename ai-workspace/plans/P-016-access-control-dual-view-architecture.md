# P-016 — Access Control & Dual-View Architecture

## Implementation Plan

> **Scope**: fullstack | **Ticket**: T-016 | **Status**: PENDING APPROVAL

---

## PHASE 1: Database & Backend Foundation

### Step 1.1 — SQL Migration: Permission Schema Update
**File**: `ai-workspace/sql/016_access_control_permissions.sql`

```sql
-- Rename can_create_charts → can_generate_charts for user-level clarity
ALTER TABLE user_template_permissions 
  RENAME COLUMN can_create_charts TO can_generate_charts;

-- Add can_analyze_charts for admin-level chart analysis
ALTER TABLE user_template_permissions 
  ADD COLUMN IF NOT EXISTS can_analyze_charts boolean DEFAULT false;
```

**Rationale**: The permission model needs two distinct chart permissions:
- `can_generate_charts` = User-level: generate charts from existing chart templates
- `can_analyze_charts` = Admin-level: AI-powered chart template creation/analysis

### Step 1.2 — New API: `/api/user/permissions` (GET)
**File**: `src/app/api/user/permissions/route.ts`

Returns the complete permission profile for the currently logged-in user in a single call:

```typescript
// Response shape:
{
  success: true,
  user: {
    user_id: string,
    account_id: string,
    role: { role_id, role_name, is_super_admin },
    module_access: [{ module_id, module_name, module_code }],
    template_permissions: [{
      report_template_id: string,
      module_id: string,
      can_generate_report: boolean,
      can_modify_template: boolean,
      can_create_template: boolean,
      can_delete_template: boolean,
      can_generate_charts: boolean,
      can_analyze_charts: boolean
    }]
  }
}
```

**Logic**:
1. `getSession()` → get `accountId`, `companyId`
2. Query `users` JOIN `roles` → get `role_id`, `is_super_admin`
3. If `is_super_admin` → return all modules + all templates with all permissions = true
4. Else → query `user_module_access` + `user_template_permissions` filtered by user

### Step 1.3 — Extend `/api/auth/me` Response
**File**: `src/app/api/auth/me/route.ts`

Add `user_id`, `role_id`, `is_super_admin`, `company_id` to response.

### Step 1.4 — Update Template Permissions API
**File**: `src/app/api/company/templates/permissions/route.ts`

Add `can_generate_charts` and `can_analyze_charts` to GET response and PUT upsert body. Rename references from `can_create_charts`.

---

## PHASE 2: Access Control Context

### Step 2.1 — Create `AccessControlContext`
**File**: `src/context/AccessControlContext.tsx`

```typescript
// Core types
interface AccessControlContextType {
  userId: string | null;
  roleId: string | null;
  roleName: string | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;        // is_super_admin OR has any admin-level permission
  isLoading: boolean;
  moduleAccess: ModuleAccess[];
  templatePermissions: TemplatePermission[];
  can: (action: PermissionAction, templateId?: string) => boolean;
  hasModuleAccess: (moduleId: string) => boolean;
  getViewMode: () => 'admin' | 'user';
  activeView: 'admin' | 'user';
  setActiveView: (view: 'admin' | 'user') => void;
}

type PermissionAction = 
  | 'generate_report' | 'modify_template' | 'create_template'
  | 'delete_template' | 'generate_charts' | 'analyze_charts';
```

**Permission resolution logic**:
- `isSuperAdmin` → `can()` always returns `true`
- `can(action, templateId)`: If `isSuperAdmin` → true; If no `templateId` → checks if user has permission on ANY template; If `templateId` → checks specific row

**View mode logic**:
- If `isSuperAdmin` or `isAdmin` → defaults to `'admin'`, can toggle
- Regular users → locked to `'user'`

### Step 2.2 — Wrap Provider in Company Layout
**File**: `src/app/[company_slug]/layout.tsx`

```tsx
<CompanyProvider>
  <AccessControlProvider>
    {children}
  </AccessControlProvider>
</CompanyProvider>
```

---

## PHASE 3: Template List — Dual View Architecture

### Step 3.1 — Admin View & User View Template List
**File**: `src/app/[company_slug]/templates/page.tsx` (REWRITE)

**Shared Layout (both views)**:
```
┌─────────────────────────────────────────────────────────┐
│  SubHeader: "Report Templates"                          │
│  [View Toggle: Admin | User] (admin/superadmin only)    │
│  [Search] [Module Filter]                               │
├──────────────────────────┬──────────────────────────────┤
│  Template List (left)    │  Template Preview (right)    │
│  - Name, Module, Status  │  - Rendered from saved       │
│  - Single arrow → icon   │    report_template_data_json │
│  - Date                  │  - Shows when selected       │
└──────────────────────────┴──────────────────────────────┘
```

**Admin View**: Arrow → Setup (if !has_setup) or Configurator. Actions disabled if no permission.
**User View**: Arrow → Generate Report. Only templates with `can_generate_report = true`.

### Step 3.2 — Template Preview Panel
**New Component**: `src/components/templates/TemplatePreviewPanel.tsx`

When user selects a template row, preview panel slides in on the right showing a mini ReportPreview from `report_template_data_json`.

### Step 3.3 — Single Arrow Navigation Icon
Replace all action buttons with one `ChevronRight` icon. Navigation logic:

```typescript
function getTemplateDestination(template, activeView) {
  if (activeView === 'user') return `/${slug}/templates/${id}/generate`;
  if (!template.has_setup) return `/${slug}/templates/${id}/setup`;
  return `/${slug}/templates/${id}/configurator`;
}
```

---

## PHASE 4: User-Level Report + Chart Generation Screen

### Step 4.1 — Redesign Generate Page
**File**: `src/app/[company_slug]/templates/[template_id]/generate/page.tsx` (REWRITE)

```
┌────────────────────────────────┬─────────────────────────┐
│  Report Configurator (Left)    │  Charts Panel (Right)   │
│  • Report Name (editable)      │  Auto-generated charts  │
│  • Date Range selector         │  from chart templates   │
│  • Filter fields               │  Only if user has       │
│  • [Generate] [Save]           │  can_generate_charts    │
│  Report Output (below)         │                         │
└────────────────────────────────┴─────────────────────────┘
```

- **No chatbot** on this screen (user-level)
- Charts auto-render after report generation (if access exists)

### Step 4.2 — Cross-Page Navigation Bar
**New Component**: `src/components/templates/TemplateNavBar.tsx`

- **Setup**: `[← Templates] [Configurator →]`
- **Configurator**: `[← Setup] [Generate →] [Charts →]`
- **Generate**: `[← Configurator] [Setup] [Charts →]`
- **Charts**: `[← Generate] [Setup]`

---

## PHASE 5: Saved Reports & Charts Viewer

### Step 5.1 — Reports List Enhancement
**File**: `src/app/[company_slug]/reports/page.tsx`

Each report row expandable to show linked charts (1:N from `charts` table).

### Step 5.2 — Report Detail + Charts View
**File**: `src/app/[company_slug]/reports/[report_id]/page.tsx` (NEW)

Left: Full report preview. Right: All linked charts. Read-only.

---

## PHASE 6: Header & Navigation Gating

### Step 6.1 — Admin Dashboard: Superadmin Only
**File**: `src/components/layout/Header.tsx`

```tsx
const { isSuperAdmin } = useAccessControl();
// Only render Admin Dashboard if isSuperAdmin (not just isAdmin)
{isSuperAdmin && <Link href={`/${slug}/admin`}>Admin Dashboard</Link>}
```

### Step 6.2 — View Mode Toggle
Show toggle pill in templates SubHeader for admin/superadmin users.

---

## PHASE 7: Permission Enforcement Matrix

| Action | Superadmin | Admin (with perm) | Admin (no perm) | User (with perm) | User (no perm) |
|:---|:---:|:---:|:---:|:---:|:---:|
| Modify Template (AI) | ✅ | ✅ | 🔒 Disabled | ❌ Hidden | ❌ Hidden |
| Create Template (AI) | ✅ | ✅ | 🔒 Disabled | ❌ Hidden | ❌ Hidden |
| Delete Template (AI) | ✅ | ✅ | 🔒 Disabled | ❌ Hidden | ❌ Hidden |
| Analyze Charts (AI) | ✅ | ✅ | 🔒 Disabled | ❌ Hidden | ❌ Hidden |
| Generate Report | ✅ | ✅ | ✅ | ✅ | 🔒 Disabled |
| Generate Charts | ✅ | ✅ | ✅ | ✅ | 🔒 Disabled |
| Admin Dashboard | ✅ | ❌ Hidden | ❌ Hidden | ❌ Hidden | ❌ Hidden |
| View Toggle | ✅ | ✅ | ✅ | ❌ Hidden | ❌ Hidden |

---

## PHASE 8: Polish & Verification

- Update `agents.md` files
- Update `db-architecture.md` with schema changes
- Run `npm run lint` and `npm run build`

---

## Files Summary

| File | Action | Phase |
|:---|:---|:---:|
| `ai-workspace/sql/016_access_control_permissions.sql` | CREATE | 1 |
| `src/app/api/user/permissions/route.ts` | CREATE | 1 |
| `src/app/api/auth/me/route.ts` | MODIFY | 1 |
| `src/app/api/company/templates/permissions/route.ts` | MODIFY | 1 |
| `src/context/AccessControlContext.tsx` | CREATE | 2 |
| `src/app/[company_slug]/layout.tsx` | MODIFY | 2 |
| `src/app/[company_slug]/templates/page.tsx` | REWRITE | 3 |
| `src/components/templates/TemplatePreviewPanel.tsx` | CREATE | 3 |
| `src/app/[company_slug]/templates/[template_id]/generate/page.tsx` | REWRITE | 4 |
| `src/components/templates/TemplateNavBar.tsx` | CREATE | 4 |
| `src/app/[company_slug]/reports/page.tsx` | MODIFY | 5 |
| `src/app/[company_slug]/reports/[report_id]/page.tsx` | CREATE | 5 |
| `src/components/layout/Header.tsx` | MODIFY | 6 |
