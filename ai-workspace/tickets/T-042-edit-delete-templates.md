# Ticket: T-042 — Edit and Delete Templates from Template List

## Objective
Enable workspace administrators to:
1. Delete templates directly from the report templates list view (soft-delete by changing status to `Archived`).
2. Edit template names directly from the report templates list view.

## Scope
- `fullstack`

## Subtasks
1. **Backend Route**: Create `src/app/api/company/templates/[template_id]/route.ts` with:
   - `PATCH` method: Updates the report template name (`report_template_name`).
   - `DELETE` method: Soft-deletes the template by setting `report_template_status` to `"Archived"`.
2. **Frontend UI Overhaul** in `src/app/[company_slug]/templates/page.tsx`:
   - In each row of the templates list (Admin View), add inline/icon buttons to Edit and Delete the template.
   - For Editing: Show an inline text input or a simple modal/prompt to enter the new template name, then trigger a `PATCH` request to update it.
   - For Deleting: Add a confirmation dialog/prompt, then trigger a `DELETE` request to archive the template.
   - Refresh the template list upon successful completion of either action.

## Status
`COMPLETED`
