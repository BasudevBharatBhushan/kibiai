# Admin Dashboard Module

## Overview
The Admin Dashboard allows company superadmins to manage staff, module access, and granular template permissions. It follows a four-column cascading selection pattern.

## Architecture
- **Page**: `src/app/[company_slug]/admin/page.tsx`
- **State Management**: Local React state for selections and cascading data fetching.
- **Header Integration**: Uses `HeaderContext` to inject "Admin Setup" breadcrumbs and License information into the global `WorkspaceHeader`.
- **API Routes**:
  - `GET /api/company/staff`: Lists all users for the company.
  - `POST /api/company/staff`: Adds a new staff member to the company.
  - `POST /api/company/modules`: Registers a new module for the company.
  - `GET/PUT /api/company/modules/access`: Manages module-level access for a user.
  - `GET/PUT /api/company/templates/permissions`: Manages granular template-level permissions.

## Components
- **WorkspaceHeader**: Reusable global header that supports dynamic titles and right-side content via `useHeader` hook.
- **Cascading Columns**:
  1. Staff List (Searchable)
  2. Modules List (for selected staff)
  3. Templates List (for selected module)
  4. Permissions Toggle (for selected template)

## Logic & State Flow
1. User selects a Staff member from the first column.
2. `selectedUserId` updates, triggering a fetch for modules.
3. User selects a Module from the second column.
4. `selectedModuleId` updates, triggering a fetch for report templates.
5. User selects a Template from the third column.
6. `selectedTemplateId` updates, allowing granular permission toggling in the fourth column.

## Design
- **Premium Aesthetic**: Uses rounded corners, subtle shadows, and a clean white/gray palette with indigo accents.
- **Responsiveness**: Currently optimized for desktop (three-to-four column layout).
