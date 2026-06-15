# T-005: Admin Operations Verification

## Status
COMPLETED

## Scope
`tests`

## Objective
Verify admin-level operations (onboarding, company management, licensing) using Playwright to ensure the recent migration to Supabase hasn't broken core administrative flows.

## Requirements
1. **Environment Setup**: Ensure the application is running and accessible at `http://localhost:3000`.
2. **Test Execution**: Run the existing Playwright test `tests/admin_management.spec.ts`.
3. **Bug Fixing**: Identify and resolve any failures in the admin dashboard or the test script itself.
4. **Validation**: Ensure the full lifecycle (Add Company -> Edit Info -> Create License -> Edit License) completes successfully.

## Linked Plan
`P-005-admin-verification.md`
