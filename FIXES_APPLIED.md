# Fixes Applied for Chart Serialization and Auto-Update Issues

## Issue 1: Chat Serialization/Trimming Not Working After Page Reload

**Problem**: When the page reloads, the chat context is not being properly serialized, causing field information to be incomplete or missing.

**Root Cause**: In `chartPromptFormatter.ts`, synthetic fields created for data fields not in the schema were incomplete, missing required `FieldSchema` properties like `table`.

**Fix Applied** (src/lib/bot/chartPromptFormatter.ts):
- Enhanced synthetic field creation to include all required FieldSchema properties
- Added `table: 'data'` property as default for synthetic fields
- Cast synthetic fields as FieldSchema to satisfy type requirements
- This ensures chat context can properly serialize field information even for fields not in the original schema

## Issue 2: Charts Not Auto-Updating When Template Data Changes

**Problem**: When a user updates the report template configuration, the new data is fetched but charts are not being re-processed and updated.

**Root Cause**: The `DashboardProvider` initialization guard uses reference comparison to detect data changes. When new data is provided with the same number of schemas/rows, the effect wouldn't re-run because it only checked if the references were different (`!==`), not if the content changed.

**Fix Applied** (src/context/DashboardContext.tsx):
- Added size-based change detection in addition to reference comparison
- Checks `initialSchemas.length` and `initialDataset.length` against previous values
- If either the schemas or dataset have changed in size, the effect re-runs even if references are unexpectedly the same
- This ensures that when template data is updated and refetched, the DashboardProvider properly re-initializes with new data

## Code Changes

### 1. chartPromptFormatter.ts
- Added complete FieldSchema properties to synthetic fields
- Ensures field serialization works correctly for both schema fields and data-only fields

### 2. DashboardContext.tsx  
- Added size comparison checks alongside reference equality checks
- Ensures effect runs when data truly changes, even if reference comparison might miss it
- Improves reliability of chart updates when template data changes

## Testing
Run the app and verify:
1. Load a template with charts
2. Check that chat displays fields correctly in the copilot
3. Update the template configuration
4. Verify that charts update with the new data
5. Reload the page and verify chat context is preserved
