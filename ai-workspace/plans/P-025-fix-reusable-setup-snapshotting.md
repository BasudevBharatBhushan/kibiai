# Implementation Plan: P-025-fix-reusable-setup-snapshotting

## Objective
Ensure that report templates created with a reusable setup automatically snapshot the setup configuration and display the correct status in the template list.

## Proposed Changes

### 1. Backend: Update Template Creation API
File: `src/app/api/company/templates/route.ts`

- In the `POST` handler:
    - If `setup_id` is provided in the request body:
        - Fetch the corresponding `setup_json` from the `report_template_setups` table.
        - Use this JSON for the `report_template_setup_json` column instead of an empty object `{}`.
    - This ensures the template has its own independent snapshot of the configuration.

- In the `GET` handler (List templates):
    - Update the `has_setup` flag calculation.
    - It should be `true` if `report_template_setup_json` is not empty **OR** if `setup_id` is not null.
    - (Wait, if we snapshot the JSON during creation, `report_template_setup_json` will already be populated, making the flag `true` with the existing logic. However, adding a check for `setup_id` is a good safety measure for any legacy or inconsistent data).

### 2. Backend: Verify Setup Fetching API
File: `src/app/api/company/templates/[template_id]/setup/route.ts`

- Review the `GET` handler to ensure it prioritize the local `report_template_setup_json` if present, but correctly falls back or merges with the library setup if `setup_id` is linked.
- (Existing code already seems to do this, but I'll ensure it's consistent).

## Verification Steps
1. **Manual Test**: Create a template using a saved setup.
2. **Database Check**: Run a SQL query to verify the `report_template_setup_json` column is populated for the new record.
3. **UI Check**: Verify the template list shows "Open" (indigo button) instead of "Setup" (amber button).
4. **Build Check**: Run `npm run build` to ensure no regressions.
