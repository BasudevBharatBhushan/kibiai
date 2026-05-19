# Implementation Plan - T-019-debug-report-generation-engine

## 1. Analyze and Fix `_limit` Bug
- Location: `src/app/api/filemaker/route.ts`
- Change: Update line 215 to use `_limit=5000` instead of `limit=5000` for the GET records endpoint.

## 2. Optimize Join Logic & Add Date Validation
- Location: `src/app/api/generate-report/route.ts` and `src/lib/utils/utility.ts`
- Change: In `processFetchOrder`, check if `pKeysToUse` is empty when `fetch_order > 1`.
- **New**: Implement `validateFmDateFilter` in `utility.ts` and use it in the `generate-report` route to validate all `date_range_fields` before processing.
- If empty, return `[]` immediately instead of calling the API.
- This prevents broad fetches that trigger timeouts and invalid dates that trigger 500 errors.

## 3. Verification
- Create a test script to call the engine with the user's failing date range (July-Dec 2025).
- Verify it returns `success: true` with empty data instead of a 500 error.
- Create another test script for Jan-June 2025 and verify it returns data.

## 4. Relationship Logic Clarification
- Explain how the engine uses `primary_table` to find the source dataset for any join, allowing for branching relationships (many children for one parent) as shown in the screenshot.
