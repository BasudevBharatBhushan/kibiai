# P-005: Admin Operations Verification

## Overview
This plan outlines the steps to verify the admin dashboard functionality using Playwright.

## Step 1: Environment Readiness
- Check if `npm run dev` is running.
- Verify access to `http://localhost:3000/admin`.
- Ensure environment variables are correctly set for local testing.

## Step 2: Test Execution
- Run `npx playwright test tests/admin_management.spec.ts`.
- Capture output and identify any failing steps.

## Step 3: Failure Analysis & Correction
- If tests fail due to UI changes (selectors): Update `tests/admin_management.spec.ts`.
- If tests fail due to logic errors: Fix the corresponding component or API route.
- Common areas to check:
    - Login flow (platform admin check).
    - Company creation (`POST /api/company`).
    - License creation (`POST /api/license`).
    - Selectors for "Add", "Save", "Edit" buttons.

## Step 4: Verification & Logging
- Re-run tests until all pass.
- Log results in `ai-workspace/execution-logs/L-005-admin-verification.md`.
- Update ticket status to COMPLETED.
