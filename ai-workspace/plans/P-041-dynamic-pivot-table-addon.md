# Implementation Plan: Dynamic Pivot Table Addon

## 1. Overview
The goal is to implement a dynamic pivot table feature as an addon within the existing dynamic reporting system, using the `@mindfiredigital/pivothead` package. This pivot table will operate purely as a computation and rendering layer over the existing structured JSON report data without modifying the underlying report engine.

## 2. Requirements & Constraints
- **Library**: `@mindfiredigital/pivothead`
- **Data Source**: Existing normalized JSON arrays (from `report_template_data_json` or `report_data_json`).
- **Initial Configuration**: Dynamically infer configuration (fields and types) directly from the input JSON data structure.
  - **Dimensions**: String/Date fields.
  - **Measures**: Numeric fields.
- **Initial State**: 
  - Render as a plain tabular dataset initially.
  - Empty rows and columns selections.
  - No pivot aggregation.
- **Dynamic Pivot Builder**:
  - UI for the user to dynamically select rows, columns, and measures.
  - When selection changes, dynamically rebuild the PivotHead config and recreate the PivotEngine instance.
- **Configuration Persistence**: 
  - Only persist minimal metadata (`rows`, `columns`, `values`).
  - Generate full PivotHead config dynamically at runtime to avoid bloated configurations.
- **Feature Scope (V1)**: 
  - Use properties: `data`, `rows`, `columns`, `measures`, `dimensions`, `defaultAggregation`, `isResponsive`.
  - Exclude initially: conditional formatting, advanced sorting, custom groupers, complex formatting, drilldown, exporting.

## 3. Architecture Design
```mermaid
graph TD;
    A[JSON Data (Report Output)] --> B[Dynamic Field Analyzer];
    B --> |Infers Dimensions & Measures| C[Dynamic Pivot Config Generator];
    C --> |Applies Selected Rows/Cols/Vals| D[PivotHead Engine Configuration];
    D --> E[Pivot Table Renderer];
    F[User UI (Drag/Drop or Select)] --> |Updates| C;
```

## 4. Implementation Steps

### Step 1: Install Dependencies
Run the installation command for the pivot table package:
```bash
npm install @mindfiredigital/pivothead
```

### Step 2: Create Dynamic Field Analyzer (`src/lib/pivot/pivotConfigGenerator.ts`)
Implement a utility to analyze the first row of the report JSON and dynamically generate base dimensions and measures:
- Iterate through `Object.entries(firstRow)`.
- If `typeof value === "number"`, push to `measures` with aggregation `"sum"`.
- Otherwise, push to `dimensions`.

### Step 3: Implement Pivot Runtime Config Generator
Create a function that takes the raw data and minimal saved state metadata (e.g. `{ rows: [], columns: [], values: [] }`) and returns a valid PivotHead configuration object.
- Initial state should return `rows: []` and `columns: []`.
- When user changes UI state, update the mapping to `config.rows`, `config.columns`, and `config.measures`.

### Step 4: Create the Pivot Table Component (`src/components/pivot/DynamicPivotTable.tsx`)
- Implement a reusable component that receives the report JSON data.
- Manage the minimal pivot state (rows, columns, measures) using local state or a context.
- Render a UI (e.g., dropdowns, pill selectors, or drag-and-drop) to allow users to select rows, columns, and measures.
- Render the PivotHead table component passing the generated dynamic configuration.

### Step 5: Integrate into the Application
- Add a "Pivot Table" button in the **Report Configurator** page (`src/components/ReportConfigurator.tsx`), alongside the existing "Charts" and "Generate" buttons.
- Clicking the button will navigate to a new route: `/[company_slug]/templates/[template_id]/pivot/page.tsx` (or open a modal).
- Ensure the Pivot component fetches or receives the latest generated report JSON dataset from `report_template_data_json`.

## 5. Metadata Schema
The persisted metadata schema inside the report template (or as a separate entity) will be kept minimal:
```typescript
interface PivotMetadata {
  rows: string[];
  columns: string[];
  values: {
    field: string;
    aggregation: string;
  }[];
}
```

## 6. Testing Strategy
- Verify that standard string/date fields correctly map to dimensions.
- Verify numeric fields default correctly to measures (sum).
- Ensure an initially empty state displays standard row-by-row data grid.
- Check that changing row/column fields instantly triggers a pivot engine rebuild.
- Confirm integration points with the existing backend API to save the minimal metadata configuration without disrupting the primary report generation logic.
