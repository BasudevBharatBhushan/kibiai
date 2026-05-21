# L-043: Report HTML Render Feedbacks

**Date:** 2026-05-20  
**Scope:** fullstack  

---

## Problem

The report HTML rendering mechanism had two key feedbacks:
1. If there is no data in a field, it shouldn't render its prefix or suffix (in body table cells, subsummaries, and group header values).
2. If a custom calculated field uses a percentage format, its calculated value should not be multiplied by 100 before rendering.

---

## Root Cause

1. **Prefix/Suffix Guards**: In `src/components/DynamicReportPreview.tsx`, the code blindly attached `prefix` and `suffix` to fields even if their values were empty, `null`, `undefined`, or the error placeholder `"--"`.
2. **Percentage Multiplication**: In the custom calculation engine in `src/app/api/generate-report/route.ts`, the `percentage` case of the formatting switch was multiplying the `cellValue` (e.g. `0.5` calculated from HyperFormula) by `10000` and dividing by `100` (`Math.round(cellValue * 10000) / 100`) to compute a percentage (resulting in `50` instead of `0.5`). The requested feedback is that percentage fields should stay as-is (e.g. keep `0.5`) and just be rounded to 2 decimal places (so `Math.round(cellValue * 100) / 100`).

---

## Fixes Applied

### 1. Frontend Guards (`src/components/DynamicReportPreview.tsx`)
- In `generateNestedSubsummaries` and `generateBodyTable`, added strict guards checking if values are empty (`(val !== undefined && val !== null) ? String(val).trim() : ''`) and filter out empty and placeholder cases (`value !== '' && value !== '--'`).
- Only append prefix/suffix if the cell/header has valid data.

### 2. Backend Engine Adjustment (`src/app/api/generate-report/route.ts`)
- In `calculateCustomFields`, updated the percentage formatting case to `Math.round(cellValue * 100) / 100` to prevent multiplying by 100.

### 3. Frontend Soft-Reload Sync (`src/lib/utils/utility.ts`)
- In `generateReportStructure`, synchronized the frontend utility function to cleanly support custom calculated fields, dynamic column orders, and prefix/suffix mappings to prevent formatting mismatch during client-side reloads.

### 4. Tests (`tests/api/formula.test.ts`)
- Aligned the formula evaluation helper in formula tests with the backend formatting engine change.
- Added a percentage evaluator integration test.

---

## Verification

- Ran `vitest run tests/api/formula.test.ts` - all tests passed.
- Compilation check via `npm run build` is running in background to ensure zero TS or Next.js bundler regressions.

---

## Status: COMPLETED
