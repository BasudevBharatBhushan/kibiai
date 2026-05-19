# T-010: Company Admin Workspace Fixes & Enhancements

## Status
COMPLETED

## Scope
`fullstack`

## Objective
Address functional gaps and UI issues in the Company Admin Workspace. This includes fixing staff visibility, implementing "Add Staff" and "Add Module" functionalities, and refining the UI for Superadmin users.

## Requirements
1. **Staff Visibility**:
   - Ensure all users associated with the company are visible in the staff portal.
   - For Superadmin users:
     - Make them "faded" or "bright" in the UI.
     - Indicate they have "All Permissions".
     - Make them un-selectable for permission editing (since they have full override).
2. **Add Staff Functionality**:
   - Implement the "Add New Staff" button with a modal/form.
   - Create the corresponding API route to handle staff creation (adding to `users` table).
3. **Add Module Functionality**:
   - Implement the "Add New Module" button with a modal/form.
   - Create the corresponding API route to handle module creation (adding to `modules` table).
4. **General Functionality**:
   - Ensure all interactive elements in the admin workspace are functional and linked to the backend.

## Linked Plan
`ai-workspace/plans/P-010-admin-workspace-fixes.md`
