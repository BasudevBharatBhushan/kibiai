# T-025: Reusable Report Template Setups

## Description
Implement a system to save, manage, and reuse report template database setups (configurations). This allows users to create a "Gold Standard" connection setup once and apply it to multiple report templates, as well as reuse existing setups when creating new templates via AI.

## Objectives
- Create a `report_template_setups` table in Supabase to store reusable JSON configurations.
- Modify `report_templates` table to reference a `setup_id`.
- Implement API endpoints for managing reusable setups.
- Update `CreateTemplateModal` to allow selecting an existing setup.
- Update `SetupWizard` to allow saving the current configuration as a reusable setup.
- Ensure strict multi-tenant isolation via RLS.

## Scope
- `backend`: Database migration, API routes, Service layer.
- `frontend`: Modal updates, Setup Wizard enhancements, new "Save Setup" UI.

## Status
- [x] Database migration (SQL)
- [x] Backend API implementation
- [x] Frontend: Reusable setup selection in Create Modal
- [x] Frontend: "Save as Reusable" in Setup Wizard
- [x] Documentation update (db-architecture.md)

## Classification
`fullstack`
