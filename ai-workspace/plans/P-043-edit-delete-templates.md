# Plan: P-043 — Edit and Delete Templates from Template List

## 1. Context and Goals
The objective is to allow administrators (Admin view) to edit report template names and soft-delete (archive) report templates.

Currently, the `TemplatesPage` page lists all templates, but does not provide inline actions to delete or rename them. The database-backed route only supports `GET` (list templates) and `POST` (create new template).

We will add these capabilities:
1. **Backend Endpoint**:
   - `PATCH /api/company/templates/[template_id]` to update `report_template_name`.
   - `DELETE /api/company/templates/[template_id]` to soft-delete/archive the template (status `"Archived"`).
2. **Frontend UI**:
   - Add inline edit and delete icons/buttons next to each template name in the `TemplatesPage` component.
   - Restrict these actions to the `Admin View` only, and ensure permission boundaries (`isSuperAdmin` or `can_modify_template`).
   - Implement an inline edit state or text input overlay when the edit button is clicked, saving the value with loading states and calling the backend endpoint.
   - Implement a clean modal or confirm alert when the delete button is clicked, calling the backend endpoint.

## 2. API Design

### 2.1 PATCH `/api/company/templates/[template_id]`
Updates specific fields of the report template.
- **Request Body**:
  ```json
  {
    "report_template_name": "New Name"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "template": { ... }
  }
  ```

### 2.2 DELETE `/api/company/templates/[template_id]`
Soft-deletes the template (updates status to `'Archived'`).
- **Response**:
  ```json
  {
    "success": true,
    "message": "Template archived successfully"
  }
  ```

## 3. Frontend Implementation Plan

### `src/app/[company_slug]/templates/page.tsx`
- Maintain local state for template under edit: `editingTemplateId`, `editingName`.
- Add inline edit button (Pencil icon) and delete button (Trash icon) in each template list row.
- Render edit input field in place of the template name if that template is currently being edited.
- Handle save action on key press `Enter` or click Save checkmark, triggering `PATCH /api/company/templates/[template_id]`.
- Handle confirm delete action using browser `confirm` or state-based prompt, triggering `DELETE /api/company/templates/[template_id]`.
- Trigger `fetchTemplates()` to reload the list on success.

## 4. Verification Plan
1. Trigger Vitest build and checks.
2. Manually test name editing and template deletion in the UI.
