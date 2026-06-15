# Module: Business Insights Engine

## Overview
This module is responsible for planning and executing business insights based on report data. It uses a split architecture:
- **Planner (AI)**: Defines formulas and templates based on field schemas.
- **Executor (JS)**: Evaluates those formulas on real datasets using HyperFormula and custom JS arithmetic.

## Architecture & Logic
- **Field Normalization**: All field names are normalized using `toSafeIdentifier` (camelCase) to ensure they are valid JavaScript identifiers and consistent between AI schema and runtime dataset keys.
- **Topological Sorting**: Formulas are executed in order of dependency (e.g., derived columns before aggregates).
- **Row-Level Logic**: Pure arithmetic (e.g., `quantity * price`) is pre-calculated row-by-row to create virtual columns.
- **Aggregate Logic**: Complex Excel-style functions (e.g., `SUMIFS`, `AVERAGE`) are evaluated using `HyperFormula` on a virtual sheet containing both raw and virtual columns.
- **Date Handling**: Date strings are automatically normalized to ISO format (`YYYY-MM-DD`) to ensure arithmetic compatibility in HyperFormula.

## State Management
- No persistent state in this module. It is a functional pipeline.
- Input: `AIInsightPlan` + `Dataset[]`.
- Output: `InsightResult[]`.

## Constraints & Rules
- **Privacy**: AI never sees actual data values.
- **Safety**: HyperFormula is used in a sandboxed, client-side capacity.
- **Function Whitelist**: Only a subset of Excel functions (SUM, COUNT, etc.) is supported as per `BUSINESS_INSIGHT_SYSTEM_INSTRUCTION`.

## Files
- `fieldSchemaAdapter.ts`: Handles schema derivation and field normalization.
- `insightFormulaExecutor.ts`: Core calculation engine.
- `insightResponseParser.ts`: AI response extraction.
- `types.ts`: Shared interfaces.
