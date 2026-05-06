# T-027: Setup Library UI/UX Refinement

## Objective
Refine the "Setup Library" interface to provide a professional, list-detail user experience with robust editing capabilities and accurate data display.

## Requirements
1. **List-Detail Layout**:
    - Left Panel: Searchable list of reusable setups.
    - Right Panel: Detailed preview and editing interface for the selected setup.
2. **Editing Capabilities**:
    - Users must be able to edit the Setup Name, Description, and the raw Setup JSON.
    - Implement real-time JSON validation with descriptive error messages.
3. **Data Integrity**:
    - Ensure `setup_json` is correctly fetched and displayed in the library.
    - Fix the "gaps" in setup info by ensuring all relevant metadata (tables, relationships) is visible.
4. **Visual Excellence**:
    - Implement skeleton loaders for initial data fetching.
    - Use a premium, responsive design with smooth transitions (per AI OPERATIONAL LAWS).
    - Ensure the JSON preview is syntax-highlighted or at least well-formatted in a code-friendly editor.

## Tasks
- [ ] Update `SetupService.getSavedSetups` to include `setup_json` in the results.
- [ ] Refactor `SetupLibraryModal.tsx` to a split-panel layout.
- [ ] Implement skeleton loaders for the setups list.
- [ ] Implement the detail/edit panel in `SetupLibraryModal.tsx`.
- [ ] Add field validation and auto-save or "Save Changes" functionality for name, description, and JSON.
- [ ] Verify build and lint.

## Status
- `COMPLETED`
