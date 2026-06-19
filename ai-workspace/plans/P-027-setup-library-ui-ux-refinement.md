# P-027: Setup Library UI/UX Refinement

## Context
The current Setup Library uses a grid of cards which is cluttered and lacks a proper preview/edit workflow. Users need to see the JSON configuration directly and edit it alongside the name and description without opening separate modals.

## Proposed Changes

### 1. Backend Adjustments
- **Service Layer**: Update `SetupService.getSavedSetups` in `src/services/setup.service.ts` to include `setup_json` in the select clause. This ensures the frontend has the data needed for previewing and counting tables/relationships without extra API calls.

### 2. Frontend Refactor (`SetupLibraryModal.tsx`)
- **State Management**:
    - `selectedSetupId`: Track which setup is currently being viewed/edited.
    - `editState`: A local copy of the selected setup's fields (name, description, json) to allow editing without affecting the main list until saved.
- **Layout**:
    - Use a flex container with two main sections.
    - **Left Panel (List)**:
        - Search bar at the top.
        - Scrollable list of items.
        - Items show name, module badge, and table count.
        - Skeleton loaders for the loading state.
    - **Right Panel (Detail/Edit)**:
        - If no setup selected: Empty state with an illustration.
        - If setup selected:
            - Editable header for Name.
            - Editable textarea for Description.
            - Module selector (dropdown).
            - Large, scrollable JSON editor (textarea with mono font).
            - "Save Changes" and "Delete" actions at the bottom/top.
            - Validation status for JSON.

### 3. Styling
- Use Vanilla CSS (CSS-in-JS or `style jsx` as per existing patterns) to achieve a "glassmorphism" or "premium dark/light" look.
- Implement smooth hover states and transitions between setups.

## Verification Plan
1. **Initial Load**: Verify skeleton loaders appear and are replaced by the list.
2. **Selection**: Verify clicking a setup loads its details in the right panel.
3. **Editing**:
    - Change name/description and save.
    - Edit JSON (add a field) and save.
    - Verify invalid JSON prevents saving.
4. **Creation**: Verify "New Setup" button works and initializes the right panel for creation.
5. **Deletion**: Verify deletion works with a confirmation.
6. **Build**: Run `npm run build` and `npm run lint`.
