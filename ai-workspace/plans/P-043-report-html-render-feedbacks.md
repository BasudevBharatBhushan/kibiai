# Implementation Plan: P-043 — Report HTML Render Feedbacks

This plan addresses report rendering issues: omitting prefix/suffix when there is no data, and avoiding multiplying custom calculated percentages by 100.

## Proposed Changes

### 1. Frontend: HTML Render (`src/components/DynamicReportPreview.tsx`)
Modify the HTML generation logic inside `generateDynamicReport` to avoid rendering prefixes and suffixes when cell values or group values are missing or contain `--`.

- **In `generateNestedSubsummaries`**:
  - Update `displayFields` loop:
    ```typescript
    const value = group[0]?.[field];
    const displayVal = (value !== undefined && value !== null) ? String(value).trim() : '';
    const hasData = displayVal !== '' && displayVal !== '--';
    const fullVal = hasData ? `${prefix}${displayVal}${suffix}` : displayVal;
    ```
  - Update group headers to check for missing `groupValue`:
    ```typescript
    const trimmedGroupVal = (groupValue !== undefined && groupValue !== null) ? String(groupValue).trim() : '';
    const hasGroupData = trimmedGroupVal !== '' && trimmedGroupVal !== '--';
    const fullGroupVal = hasGroupData ? `${groupFieldPrefix}${trimmedGroupVal}${groupFieldSuffix}` : (trimmedGroupVal || 'N/A');
    ```

- **In `generateBodyTable`**:
  - Update `displayFields` body row rendering:
    ```typescript
    const displayVal = (cellValue !== undefined && cellValue !== null) ? String(cellValue).trim() : '';
    const hasData = displayVal !== '' && displayVal !== '--';
    const fullVal = hasData ? (prefix + displayVal + suffix) : displayVal;
    ```

### 2. Backend: Custom Calculations Percentage Format (`src/app/api/generate-report/route.ts` & `tests/api/formula.test.ts`)
Update the custom calculation engine where `format === "percentage"` is handled:
- In `calculateCustomFields` of both files, change:
  ```typescript
  case "percentage":
    finalValue = Math.round(cellValue * 10000) / 100;
    break;
  ```
  to:
  ```typescript
  case "percentage":
    finalValue = Math.round(cellValue * 100) / 100;
    break;
  ```

### 3. Consistency: Client-side Soft Reloads (`src/lib/utils/utility.ts`)
Sync calculated fields custom formatting and mappings from `route.ts`'s `generateReportStructure` into `src/lib/utils/utility.ts` so soft reloads produce consistent prefix/suffix rendering:
- Update `getFieldLabel` helper inside `generateReportStructure` to handle calculated fields.
- Update `bodyFieldOrder` to inject calculated fields.
- Update `bodySortOrder` check to fallback to calculated fields.
- Add prefix/suffix lookup logic for calculated fields.

---

## Verification Plan

### Automated Tests
- Run `vitest tests/api/formula.test.ts` to verify calculated field evaluation.
- Run `npm run build` to verify no TypeScript or bundle compile errors.

### Manual Verification
- Render a report featuring custom calculated percentage fields to verify they display correct numbers with `%` suffix but no multiplication by 100.
- Verify fields without data show empty space without prefix/suffix.
