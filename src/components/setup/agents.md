# Setup Module Architecture

## Overview
The setup module provides a wizard-like interface for configuring template data sources, table mappings, and relationships. It supports both FileMaker Data API and OData API protocols.

## Components
- **SetupWizard**: The main container that manages the configuration state using a reducer.
- **HostConfigSection**: Handles host URL and protocol selection.
- **AddDatabaseSection**: Handles fetching table/layout metadata and adding new tables to the config.
- **TableCard**: Displays and allows editing of individual table configurations and field mappings.
- **RelationshipsPanel**: Manages the relationships between defined tables.
- **SetupJsonPreview**: Provides a live JSON preview of the configuration.
- **ODataFieldModal**: A modal for selecting fields when using the OData protocol.
- **SetupLibraryModal**: A professional list-detail library for managing reusable database configurations across templates.

## Data Flow
1. **State Management**: The central state is a `SetupConfig` object managed by a `useReducer` in `SetupWizard`. Local component state also manages UI modes (JSON preview, database modals) and persistence status (`saveStatus`, `saveError`).
2. **Persistence**: The configuration is loaded from and saved to the `/api/company/templates/[id]/setup` endpoint. If a template is linked to a reusable setup via `setup_id`, the API dynamically merges the reusable JSON into the template's response.
3. **Reusable Setups**: Users can save a configuration as a "Reusable Setup" via `SaveSetupModal`. These are stored in the `report_template_setups` table.
4. **Setup Application**: The `SetupWizard` sidebar displays available reusable setups for the current module. Applying one links the template to that setup via `PATCH`. Saving a manual customization in the wizard unlinks the reusable setup (sets `setup_id` to null) and stores the config locally in `report_template_setup_json`.
5. **Circular Dependencies**: Core interfaces (`TableConfig`, `FieldConfig`, etc.) are moved to `types.ts` to prevent circular dependencies between `SetupWizard` and its sub-components.

## Types
Defined in `types.ts`:
- `FieldConfig`: Individual field mapping settings.
- `TableConfig`: Database table settings including layout and field maps.
- `Relationship`: Joins between tables.
- `SetupConfig`: The root configuration object.
