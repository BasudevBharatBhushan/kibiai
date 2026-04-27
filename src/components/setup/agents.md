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

## Data Flow
1. **State Management**: The central state is a `SetupConfig` object managed by a `useReducer` in `SetupWizard`.
2. **Persistence**: The configuration is loaded from and saved to the `/api/company/templates/[id]/setup` endpoint.
3. **Circular Dependencies**: Core interfaces (`TableConfig`, `FieldConfig`, etc.) are moved to `types.ts` to prevent circular dependencies between `SetupWizard` and its sub-components.

## Types
Defined in `types.ts`:
- `FieldConfig`: Individual field mapping settings.
- `TableConfig`: Database table settings including layout and field maps.
- `Relationship`: Joins between tables.
- `SetupConfig`: The root configuration object.
