# P-024: Contextual Date Tokens for Business Insights

## Architecture & Approach
The Business Insight engine currently generates plans using hardcoded date functions like `TODAY()`, making insights generated today invalid for historical report viewing or custom date ranges. We will introduce contextual date tokens (`REPORT_START`, `REPORT_END`, `REPORT_MIDPOINT`) that are injected into the context at runtime, allowing the AI's plans to be invariant over the report date bounds.

## Steps

### Step 1: Update System Instructions
**File:** `src/constants/businessInsightSystemInstruction.ts`
- Update the **TIME LOGIC RULES** section.
- Instruction: AI MUST NOT use `TODAY()` for report-level trends. Must use:
  - `REPORT_START`: Start date of report current range.
  - `REPORT_END`: End date of report current range.
  - `REPORT_MIDPOINT`: Date halfway between start and end.
- Update examples to use these tokens in `SUMIFS` and `COUNTIFS`.

### Step 2: Update the Formula Executor
**File:** `src/lib/insights/insightFormulaExecutor.ts`
- Add `InsightContext` interface with `reportStart`, `reportEnd`.
- Modify `executeInsightPlan` to accept an optional `context: InsightContext`.
- Logic:
  1. Calculate `REPORT_MIDPOINT`.
  2. Replace `REPORT_START`, `REPORT_END`, `REPORT_MIDPOINT` in formula strings before HyperFormula.
  3. Default `REPORT_END` to today, `REPORT_START` to 30 days prior if not provided.

### Step 3: Update Prompt Formatter
**File:** `src/lib/bot/insightPromptFormatter.ts`
- Modify `buildInsightPredefinedPrompt`.
- Add `"context_variables"` to JSON schema listing tokens.

### Step 4: Verification & Testing
**File:** `tests/lib/insights/insightFormulaExecutor.test.ts`
- Add a new test passing a specific `context`.
- Verify insight correctly aggregates data within the range.
