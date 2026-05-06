# Implementation Plan: Restore Preview Data Persistence

Restoring the persistence of generated report JSON data to `report_templates.report_template_data_json` to support preview reloading and chart generation.

## Proposed Changes

### 1. Backend: Update Generation API
- File: `src/app/api/templates/[template_id]/generate/route.ts`
- Modify `generateBodySchema` to include `persist_to_template: z.boolean().optional()`.
- If `persist_to_template` is true, perform an `update` on the `report_templates` table setting `report_template_data_json` to the generated `reportStructureJson`.

### 2. Frontend: Update Configurator Component
- File: `src/components/ReportConfigurator.tsx`
- In `handleUpdate`, when calling `/api/templates/${state.templateId}/generate`, pass `{ persist_to_template: true }` in the body.

### 3. Frontend: Update Configurator Page
- File: `src/app/[company_slug]/templates/[template_id]/configurator/page.tsx`
- In `fetchLivePreview`, when calling `/api/templates/${templateId}/generate`, pass `{ persist_to_template: true }` in the body.
- This ensures that AI-driven configuration changes also update the preview data in the database.

## Verification Plan
1. Open a report template configurator.
2. Modify a configuration (e.g., change a column label or add a field).
3. Click "Update".
4. Verify via database query that `report_template_data_json` is updated in the `report_templates` table.
5. Reload the page and verify that the preview loads from the saved JSON (no "Generating..." loader should appear if data is present).
6. Navigate to the Chart Builder and verify that "rows" and "fieldNames" are correctly populated.
