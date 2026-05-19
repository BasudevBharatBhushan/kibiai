# Execution Log - L-006-tenant-enhancements

**Date**: 2026-04-27
**Ticket**: T-006
**Status**: COMPLETED

## Summary
Enhanced tenant onboarding process with role linking, unique name enforcement, and UI clarity.

## Changes
### Database
- Added `role_id` column to `users` table referencing `roles(role_id)`.
- Created index on `users(role_id)` for faster lookups.
- Updated `db-architecture.md` with the new schema.

### Backend
- **POST /api/company**:
  - Now checks for existing company name before creation.
  - Automatically creates a "Client Superadmin" role (is_super_admin: true).
  - Creates the first user and links it to the newly created role.
  - Improved error handling with `maybeSingle()` to prevent unnecessary query errors.

### Frontend
- **CompanyList.tsx**:
  - Added informational note explaining the purpose of auth credentials.
  - Added client-side duplicate name check to prevent redundant API calls.
- **CompanyDetails.tsx**:
  - Added informational note about auth credentials for clarity.
- **LicenseInfo.tsx**:
  - Cleaned up and standardized plan naming to uppercase (aligned with `PLAN_OPTIONS`).

## Verification Results
- **Playwright Tests**: `tests/admin_management.spec.ts` passed successfully.
- **Manual Check**: Verified that duplicate company names are blocked and that the superadmin role is correctly assigned to new onboarding users.
