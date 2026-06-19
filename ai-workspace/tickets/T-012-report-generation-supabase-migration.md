# T-012 — Report Generation: Supabase Migration & AI Configurator

## Status: TODO

## Type: fullstack

## Summary
Migrate the existing report generation engine from the FileMaker-centric architecture to a Supabase-backed system, and build the full AI Report Configurator experience integrated with the new template flow.

## Context
- The Setup Wizard (T-011) is complete and saves `report_template_setup_json` into `report_templates` in Supabase.
- The existing backend report engine (`/api/generate-report`, `/api/filemaker-report`, `lib/utils/utility.ts`) is fully operational but reads setup/config from FileMaker records.
- The existing `ReportConfigurator` component and related `report-builder` components are fully built but are bound to FileMaker record IDs.
- The Supabase `report_templates` table has all required columns: `report_template_setup_json`, `report_template_config_json`, `report_template_data_json`, `conversation_id`.
- The `reports` table exists in Supabase for persisting generated report snapshots.
- FileMaker is kept as a **data source only** (fetched via the existing `fetchFmRecord` utility) — not as the metadata/config store.

## Goal
1. Migrate the AI Report Configurator to read setup_json and config_json from Supabase (not FileMaker metadata tables).
2. Build the Report Configurator page at `[company_slug]/templates/[template_id]/configurator`.
3. Build the Report Generation Screen that runs the engine, stores result in Supabase `reports` table.
4. Wire up navigation: Template List → Setup (if not setup) → Configurator → Generate Report.
5. Restructure the `kibiai/reports` area to be Supabase-driven.

## Linked Plan
P-012-report-generation-supabase-migration.md
