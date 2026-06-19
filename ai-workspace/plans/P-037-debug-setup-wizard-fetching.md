# Implementation Plan: P-037-debug-setup-wizard-fetching

## Goal
Diagnose and fix the "unable to fetch tables" error in the Setup Wizard.

## Execution Steps
1. **Run Vitest**:
   - Execute `npx vitest tests/api/filemaker_setup.test.ts` to verify the API endpoints.
2. **Analyze Failure**:
   - Inspect the `/api/filemaker/setup/layouts` and `fields` routes.
3. **Fix Code**:
   - Resolve any network, authentication, or parsing issues with the FileMaker connection.
4. **Verification**:
   - Ensure the Vitest test passes.
