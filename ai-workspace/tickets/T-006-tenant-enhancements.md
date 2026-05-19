# T-006: Enhanced Tenant Onboarding & Role Linking

## Status
COMPLETED

## Scope
`fullstack`

## Objective
Enhance the tenant onboarding process by adding role-based user creation, enforcing company name uniqueness, and improving UI clarity regarding auth credentials.

## Requirements
1. **Schema Update**: Add `role_id` to `users` table.
2. **Backend Logic**:
   - Enforce unique company names in `POST /api/company`.
   - Create "Client Superadmin" role during onboarding.
   - Link the first user to the newly created role.
3. **UI Improvements**:
   - Add informational context to "Company Auth Email" and "Password" fields in `CompanyList` and `CompanyDetails`.
   - Add UI-level check for duplicate company names.
4. **Cleanup**: Standardize plan naming conventions across the application.

## Linked Plan
`P-006-tenant-enhancements.md`
