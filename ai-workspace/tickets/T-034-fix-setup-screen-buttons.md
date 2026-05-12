# Ticket: T-034 Fix Setup Screen Buttons

## Status: COMPLETED
## Scope: frontend
## Description
The "Add Database" buttons on the template setup screen are not working. Clicking them updates the component state but does not trigger any UI changes because the `AddDatabaseSection` component is missing from the rendering logic in `SetupWizard.tsx`.

## Objectives
- Integrate `AddDatabaseSection` into the `SetupWizard.tsx` rendering logic.
- Ensure the "Add Database" modal appears when the sidebar "+" button or the empty state button is clicked.
- Verify that the "Save" and "Continue" buttons are correctly rendered via portals.

## Technical Details
- **File**: `src/components/setup/SetupWizard.tsx`
- **Missing Component**: `AddDatabaseSection`
- **State**: `showAddDatabaseModal`

## Acceptance Criteria
- Clicking "Add Database" (sidebar or main) opens the setup modal.
- Users can fetch tables and add a new database configuration.
- The "Save" and "Continue" buttons in the sub-header are functional.
- No ESLint or build errors.
