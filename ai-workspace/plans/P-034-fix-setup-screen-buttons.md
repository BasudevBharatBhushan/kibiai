# Implementation Plan: P-034 Fix Setup Screen Buttons

## Objective
Restore functionality to the template setup screen by integrating the missing `AddDatabaseSection` component and verifying button interactions.

## Proposed Changes

### 1. Frontend: SetupWizard.tsx
- Locate the JSX return block.
- Add conditional rendering for `AddDatabaseSection` using the `showAddDatabaseModal` state.
- Pass required props:
  - `host`: `config.host`
  - `protocol`: `config.data_fetching_protocol`
  - `tableCount`: `Object.keys(config.tables).length`
  - `existingTableNames`: `Object.keys(config.tables)`
  - `onTableAdded`: Callback to dispatch `ADD_TABLE` action.
  - `onClose`: Callback to set `showAddDatabaseModal` to `false`.

### 2. Verification
- Manual verification of the "Add Database" modal.
- Verification of the "Save" and "Continue" buttons in the SubHeader.

## Step-by-Step Execution
1. **[T-034-1]** Update `src/components/setup/SetupWizard.tsx` to include `AddDatabaseSection` in the JSX.
2. **[T-034-2]** Run `npm run lint` to ensure no regressions.
3. **[T-034-3]** Perform a test build if necessary to verify portal and component integration.

## Testing Strategy
- **Manual Test**: Open the setup screen, click "Add Database", and verify the modal appears.
- **Manual Test**: Enter dummy host/credentials and verify "Fetch Tables" works (if backend is available) or fails gracefully with a message.
- **Lint**: `npx eslint src/components/setup/SetupWizard.tsx`
