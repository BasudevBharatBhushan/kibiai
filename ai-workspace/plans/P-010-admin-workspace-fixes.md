# P-010: Company Admin Workspace Fixes & Enhancements

This plan outlines the fixes and enhancements for the Company Admin Workspace.

## Phase 1: Staff Visibility & Superadmin UI
- [ ] Investigate why some staff might be missing (check `roles` relationship and `company_id` consistency).
- [ ] Update `src/app/[company_slug]/admin/page.tsx` to handle Superadmin UI:
    - Apply "faded/bright" styling.
    - Display "All Permissions" badge.
    - Disable selection/editing for Superadmins.
- [ ] Fix potential array/object mismatch in `roles` data returned by Supabase.

## Phase 2: Add Staff Functionality
- [ ] Create a modal component for adding new staff.
- [ ] Implement the backend API route `POST /api/company/staff` to create a new user.
- [ ] Connect the "Add New Staff" button to the modal and API.

## Phase 3: Add Module Functionality
- [ ] Create a modal component for adding new modules.
- [ ] Implement the backend API route `POST /api/company/modules` to create a new module.
- [ ] Connect the "Add New Module" button to the modal and API.

## Phase 4: Verification & Cleanup
- [ ] Verify all new functionalities.
- [ ] Perform `npm run lint` and `npm run build`.
- [ ] Log changes in `ai-workspace/execution-logs/L-010-admin-workspace-fixes.md`.

## References
- `ai-workspace/docs/appilcation_document/application_document.txt`
- `src/app/[company_slug]/admin/page.tsx`
- `src/app/api/company/staff/route.ts`
