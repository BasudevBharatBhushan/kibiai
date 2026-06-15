# T-024: Contextual Date Tokens for Business Insights

## Status
COMPLETED

## Objective
Modify the Business Insight Engine to support Contextual Date Tokens (`REPORT_START`, `REPORT_END`, `REPORT_MIDPOINT`). This allows the AI to generate insight templates that are reusable across any report date range, replacing the current problematic hardcoded logic (like `TODAY()-30`).

## Details
1. Update System Instructions (`src/constants/businessInsightSystemInstruction.ts`) to mandate the use of `REPORT_START`, `REPORT_END`, `REPORT_MIDPOINT` instead of `TODAY()`.
2. Update the Formula Executor (`src/lib/insights/insightFormulaExecutor.ts`) to accept an optional `context` object, and calculate/replace the tokens before hyperformula evaluation.
3. Update Prompt Formatter (`src/lib/bot/insightPromptFormatter.ts`) to add `context_variables` to the JSON schema.
4. Add Verification & Testing (`tests/lib/insights/insightFormulaExecutor.test.ts`) with a test case covering a specific context.
