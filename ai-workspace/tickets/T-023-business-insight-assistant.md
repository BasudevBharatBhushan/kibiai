# T-023 — Business Insight Assistant (Separate AI Engine)

## Status: COMPLETED

## Type: fullstack

## Summary
Decouple business insight generation from the Chart Copilot and create a dedicated AI Business Insight Assistant. The assistant will appear as a togglable panel on the Chart Analysis screen, with its own conversation thread, persistence, and computation engine.

## Background
Business insight generation is currently embedded inside the Chart Copilot flow. It handles it as a side-effect response alongside chart generation. Per the KiBiAI Business Insight Engine design doc, insights should:
- Never send raw data to AI
- Use AI only as a planner (schema + field names + meanings)
- Use JavaScript as the sole executor of Excel-formula-based calculations
- Be rendered as typed insight cards (trend, anomaly, risk, opportunity, efficiency, quality)

## Goals
1. Add `insight_conversation_id` column to `report_templates` table
2. Create a dedicated API route for the Business Insight Assistant (`/api/assistant/insights`)
3. Create the `BUSINESS_INSIGHT_SYSTEM_INSTRUCTION` constant (ultra-strict planner prompt from the design doc)
4. Create a `buildInsightPredefinedPrompt()` utility to send schema-only context
5. Create an `insightFormulaExecutor` service to evaluate Excel formulas on the dataset using the existing parser
6. Create `InsightCard` and `InsightDashboard` UI components
7. Add a mode toggle ("Chart Copilot" / "Business Insights") to the Chart Builder header
8. Wire up the insight conversation lifecycle: create thread → persist conv id → fetch history on mode switch
9. Remove business insight generation from the Chart Copilot instruction set

## Acceptance Criteria
- [ ] Clicking "Business Insights" mode in the chart screen switches the chatbot context
- [ ] Insight conversation ID is stored and restored per template
- [ ] AI only receives schema (field names + types + meanings), never actual data values
- [ ] JS executes all formulas; AI just defines them
- [ ] Insight cards render with category badge and severity indicator
- [ ] Past insight conversation is fetched when switching to insight mode
- [ ] Chart Copilot no longer generates business insights

## Dependencies
- Existing `chart_conversation_id` pattern in `report_templates`
- Existing `ModularChatbot` component
- Existing `/api/assistant` route pattern
- Existing Excel formula evaluator (used in report engine)

## Related
- Design Doc: `ai-workspace/docs/KiBiAI- AI-Driven Business Insight Engine – Design & Implementation.txt`
- Plan: `ai-workspace/plans/P-023-business-insight-assistant.md`
