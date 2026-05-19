# Execution Log: L-025-fix-reusable-setup-snapshotting

## Task
Fix reusable setup snapshotting and template list status.

## Changes
1. **API Update**: Modified `src/app/api/company/templates/route.ts`.
    - Updated `POST` handler to fetch `setup_json` from `report_template_setups` if `setup_id` is provided and save it into `report_template_setup_json`.
    - Updated `GET` handler's `has_setup` calculation to return `true` if `setup_id` is present or local JSON is populated.
2. **Impact**:
    - New templates created with a reusable setup will now have a local snapshot of the configuration.
    - The template list will now correctly show "Open" (Complete) for these templates instead of "Setup" (Incomplete).

## Verification
- Build is in progress.
- Code reviewed for logic and security (session company_id check is preserved).
