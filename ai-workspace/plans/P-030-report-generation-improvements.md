# P-030 — Implementation Plan

## Step 1: Fix stream route setup_id fallback (Bug)
File: `src/app/api/templates/[template_id]/generate/stream/route.ts`
- Add same setup_id fallback logic as the regular generate route
- Fetch from report_template_setups if local setup_json is empty

## Step 2: Add persist_to_template to stream route + admin uses SSE
Files:
- `src/app/api/templates/[template_id]/generate/stream/route.ts` — add persist_to_template to body schema and save logic
- `src/components/ReportConfigurator.tsx` — switch handleUpdate to use SSE stream
- Add log state + floating log panel UI to ReportConfigurator

## Step 3: Delete SubmitToolbar.tsx
File: `src/components/report-builder/SubmitToolbar.tsx` — delete

## Step 4: Update REPORTS_SYSTEM_INSTRUCTION
File: `src/constants/reportsSystemInstruction.ts`
- Add explicit "Field Overlap Rule": a field in group_by_fields (field, display, group_total) MUST NOT also appear in report_columns
- Tighten the instruction to remove redundant/verbose sections

## Step 5: Config Sanitization utility
File: `src/lib/utils/sanitizeReportConfig.ts` (new)
- Create sanitizeReportConfig(config) function
- Removes from report_columns any field that appears in group_by_fields (field, display, group_total)
- Removes duplicate body_sort_order entries
- Removes calculated fields from db_defination
- Returns cleaned config

## Step 6: Apply sanitization in configurator page + handleAssistantResponse
File: `src/app/[company_slug]/templates/[template_id]/configurator/page.tsx`
- Import and apply sanitizeReportConfig before dispatching AI response config
- Apply before saving to DB via apiClient.post config endpoint

## Step 7: Fix autoInitialize trigger condition
File: `src/app/[company_slug]/templates/[template_id]/configurator/page.tsx`
- Pass `autoInitialize={!data.has_preview_data}` instead of always true
- Add `has_preview_data` to the config API response

## Step 8: Verify new thread context passing
File: `src/components/chat/ModularChatbot.tsx`
- handleNewChat currently nulls conversationId and clears messages
- autoInitialize effect re-triggers because conversationId becomes null + messages.length becomes 0 + predefinedPrompt exists
- This SHOULD re-trigger init with fresh schema — confirm it works correctly
- If predefinedPrompt is not updated at new-thread time, it may send stale data → fix by ensuring configuratorPage always passes latest predefinedPrompt (it uses useMemo on state.setup/config — this is correct)
