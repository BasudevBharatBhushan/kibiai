# Ticket: Restore Preview Data Persistence in Report Builder

## Problem
The report template builder (configurator) is currently not saving the generated report JSON data back to the `report_templates` table (`report_template_data_json` column). This breaks the flow where re-loading the configurator should use the saved preview data instead of re-generating it. More importantly, it breaks chart generation because the chart builder relies on this saved preview data to derive field schemas and provide a dataset for visualization.

## Objectives
1. Update the template generation API to support an optional flag for persisting the generated report data back to the template.
2. Update the Report Configurator and Configurator Page to use this flag during preview generation.
3. Ensure that when a template is loaded, the saved preview data is correctly used if present.

## Scope
- `backend`: `src/app/api/templates/[template_id]/generate/route.ts`
- `frontend`: `src/components/ReportConfigurator.tsx`, `src/app/[company_slug]/templates/[template_id]/configurator/page.tsx`

## Status
COMPLETED
