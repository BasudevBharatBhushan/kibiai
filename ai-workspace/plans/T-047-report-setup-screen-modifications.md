# Implementation Plan - T-047 Report Setup Screen Modifications & Bugfixes

## Proposed Changes

### Frontend Components

#### [MODIFY] [TableCard.tsx](file:///e:/Dev/Next%20JS/kibiai/src/components/setup/TableCard.tsx)
- Add a client-side search bar above the fields table.
- Filter fields by matching the query against `fieldName` and `field.label` (case-insensitive).
- Provide a clean empty state in the fields table if no fields match the query.

#### [MODIFY] [SetupWizard.tsx](file:///e:/Dev/Next%20JS/kibiai/src/components/setup/SetupWizard.tsx)
- Force `TableCard` to remount when changing active tables by adding `key={selectedView}`.
- Remove the limit of 5 databases in the `ADD_TABLE` reducer action.
- Update `handleApplySetup` to set the save state (`saving` then `saved` or `error`), matching manual save UX, showing the user that the reusable setup was autosaved.

#### [MODIFY] [AddDatabaseSection.tsx](file:///e:/Dev/Next%20JS/kibiai/src/components/setup/AddDatabaseSection.tsx)
- Remove the 5 database limit validation check (`tableCount >= 5`).
- Remove/modify the banner UI indicating "Max 5 databases allowed".
- Automatically clear the fetched layouts/tables state if host, database file name, protocol, username or password changes to prevent stale data displays.

## Verification Plan
1. Select a database, click "Available Setups", apply a setup, and verify that the save indicator animates from "Saving..." to "Saved".
2. Add more than 5 tables to verify that the limit is successfully removed.
3. Select a different table in the sidebar list and verify that the "Table Name" input updates its value instantly to reflect the newly selected table.
4. Type in the search bar of the `TableCard` to verify that field list filtering works dynamically by field name and label.
