# Ticket: T-047 - Report Setup Screen Modifications & Bugfixes

- **Ticket ID**: T-047
- **Scope Classification**: frontend
- **Objective**: Fix critical bugs and apply requested UI modifications in the report setup screen, including fixing selection updates, removing the database selection limit, autosaving reusable setups, and adding a client-side search bar for fields/labels in TableCard.
- **Status**: COMPLETED

## Scope & Context
- Components: `SetupWizard.tsx`, `AddDatabaseSection.tsx`, `TableCard.tsx`
- Related API route: `src/app/api/company/templates/[template_id]/setup/route.ts`

## Acceptance Criteria
1. **Selection Update Bug**: Selecting a different database in the sidebar must correctly update all fields in the TableCard component, including the "Table Name" input field.
2. **Remove DB Limit**: Users must be able to add more than 5 databases/tables in both `SetupWizard` (reducer) and `AddDatabaseSection` UI (remove limits, warnings, and messages about "Max 5").
3. **Autosave Reusable Setup**: Selecting/loading a reusable setup from the "Available Setups" list must autosave the template immediately and animate/update the "Save" button to indicate the successfully saved state.
4. **UI-Level Search Bar**: Add a small client-side search input above the fields list in `TableCard.tsx` to filter fields or labels dynamically by text query.

## Constraints
- Do not affect existing layout configurations or database connections.
- Ensure styling and transitions remain premium and matching current design.

## Dependencies
- None
