# Ticket: T-043 — Report HTML Render Feedbacks

## Objective
Address specific feedbacks on report HTML rendering and custom calculated fields:
1. If there is no data in a field, do not show the prefix or suffix.
2. If a custom calculated field is a percentage format, do not multiply its value by 100 (keep the value as-is and just round to 2 decimal places).

## Scope
- `fullstack`

## Subtasks
1. **Frontend HTML Rendering (`src/components/DynamicReportPreview.tsx`)**:
   - In `generateNestedSubsummaries` (display fields and group values) and `generateBodyTable`, check if the value is empty (`""`, `null`, `undefined`, or `"--"`). If empty, do not apply prefix and suffix.
2. **Backend Custom Calculation (`src/app/api/generate-report/route.ts`)**:
   - In `calculateCustomFields`, update the `percentage` case of the format switch to not multiply the calculated `cellValue` by 100 (i.e. use `Math.round(cellValue * 100) / 100` instead of `Math.round(cellValue * 10000) / 100`).
3. **Synchronization & Consistency (`src/lib/utils/utility.ts` & `tests/api/formula.test.ts`)**:
   - In `src/lib/utils/utility.ts`'s `generateReportStructure`, ensure custom calculated field definitions, labels, prefixes, and suffixes are properly integrated (matching the logic in `route.ts`).
   - In `tests/api/formula.test.ts`, update the duplicated formula evaluation logic's percentage format handling to match the backend.

## Status
`COMPLETED`
