# Ticket: T-025-fix-reusable-setup-snapshotting
Status: COMPLETED
Assignee: Antigravity
Priority: High
Scope: Backend

## Problem
When creating a new report template using a reusable setup from the library, the `setup_json` is not being copied into the template's `report_template_setup_json` column. It is only saving the `setup_id`. This causes:
1. The template list to show "Setup" (incomplete) instead of "Open" (complete) because the `has_setup` flag depends on `report_template_setup_json` being populated.
2. The Setup Wizard to potentially show an empty state or require re-adding databases if it doesn't correctly fallback to the library setup.

## Requirements
1. Update `POST /api/company/templates` to fetch the `setup_json` from `report_template_setups` if a `setup_id` is provided.
2. Persist this `setup_json` into the new `report_templates` record.
3. Ensure the `has_setup` flag in the template list API correctly reflects that a setup is present.

## Verification
1. Create a new template with a reusable setup.
2. Verify that `report_template_setup_json` in the database is not empty.
3. Verify that the template list shows "Open" for the new template.
4. Verify that the Setup Wizard for the new template loads the configuration automatically.
