# Implementation Plan: P-036-fix-setup-wizard-build-error

## Goal
Fix the build error in `SetupWizard.tsx` by defining the missing `saveError` state and ensuring it is correctly managed during the save process.

## Proposed Changes

### Frontend: `src/components/setup/SetupWizard.tsx`
- Add `saveError` state variable using `useState`.
- Update `handleSave` function to:
    - Clear `saveError` at the start.
    - Set `saveError` in the `catch` block with a descriptive message.
- (Optional) Add a small error message display near the save button if `saveStatus === "error"`.

### Backend/Utils: `src/utils/auth.ts`
- Await `headers()` call in `createSession`.

## Execution Steps
1. **Modify `SetupWizard.tsx`**:
    - Add `const [saveError, setSaveError] = useState<string | null>(null);` near other state definitions.
    - Update `handleSave` catch block to `setSaveError(e instanceof Error ? e.message : "Failed to save");`.
2. **Modify `auth.ts`**:
    - Update line 37 to properly await `headers()`.
3. **Verification**:
    - Run `npm run lint` to check for syntax/type errors.
    - Run `npm run build` to ensure the project builds successfully.

## Risks
- None expected, this is a straightforward type/variable fix.
