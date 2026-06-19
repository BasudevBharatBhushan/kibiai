# 2026-05-07 Fix Insight Regressions

## Issue

The Business Insight generation was reported to be failing and throwing errors during the AI insight evaluation pipeline. Additionally, the insight module test suite was failing.

## Root Cause

1. The `toSafeIdentifier` utility function in `fieldSchemaAdapter.ts` was previously modified to strictly force a camelCase format (e.g. converting `SalesID` to `salesID` and `Quantity` to `quantity`).
2. The unit tests in `fieldSchemaAdapter.test.ts` were hardcoded to expect the old mapping behavior (expecting `SalesID` and `Quantity`), which caused the test suite to fail.
3. The prompt formatter unit tests (`insightPromptFormatter.test.ts`) failed because a new top-level property (`context_variables`) was added but the assertions only expected `['module', 'fields']`.
4. **The parser functional bug:** The `insightResponseParser.ts` failed to parse the AI payload properly because the API payload returned the JSON response as a stringified value under `parsed.response`. The parser attempted to access `parsed.response.insights` without first parsing the nested string, resulting in `[InsightParser] Response missing 'insights' array` and returning `null`. This resulted in zero insights being generated in the UI.
5. **The formula mapping bug:** The API returns data where object keys contain the table name (e.g. `Sales Transaction List::qtyShipped`), but the field schema sent to the AI strictly stripped the table name (`qtyShipped`). As a result, the `toSafeIdentifier` transformation inside `insightFormulaExecutor.ts` produced `salesTransactionListQtyShipped` while the formula execution engine expected `qtyShipped`. This caused a `ReferenceError` during formula evaluation, returning `null` for calculations like `qtyShipped * priceOfSale`.

## Resolution

- **Parser Fix**: Added a type check in `parseInsightResponse` to detect if `parsed.response` is a stringified JSON. If it is, we now explicitly execute `JSON.parse(parsed.response)` before validating the array structure. This allows the system to seamlessly ingest AI payloads regardless of stringification.
- **Table Prefix Fix**: Updated `insightFormulaExecutor.ts` to strictly strip the `Table::` prefix using `.split("::").pop()` before executing `toSafeIdentifier`. This correctly aligns the dataset parameter names (e.g., `qtyShipped`) to match the field schemas exposed to the AI, ensuring formulas execute flawlessly.
- **Test Alignment**: Updated the `fieldSchemaAdapter.test.ts` assertions to correctly match the new strictly-camelCased field names (e.g., `quantity`, `salesDate`, `salesID`, `fullName`, `lineAmount`).
- **Prompt Formatter Fix**: Updated `insightPromptFormatter.test.ts` to expect `context_variables` within the predefined prompt JSON structure.
- **Validation**: Executed the `executeInsightPlan` with the provided AI payload utilizing HyperFormula `SUMIFS` expressions. The execution successfully resolved and correctly returned numerical insights, verifying the core pipeline works perfectly.
- **Final Checks**: Cleaned up temporary test files, ran `npm run lint`, and confirmed `npm run build` succeeds successfully.
