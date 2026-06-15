-- Migration: 023_add_insight_fields
-- Ticket: T-023 — Business Insight Assistant
-- Adds two new columns to report_templates:
--   1. insight_conversation_id — OpenAI Responses API conversation ID for the Business Insight session
--   2. insight_results         — Persisted computed InsightResult[] JSON (JS-executed, not AI-generated data)

ALTER TABLE report_templates
ADD COLUMN IF NOT EXISTS insight_conversation_id varchar DEFAULT NULL;

ALTER TABLE report_templates
ADD COLUMN IF NOT EXISTS insight_results jsonb DEFAULT NULL;

COMMENT ON COLUMN report_templates.insight_conversation_id
IS 'OpenAI Responses API conversation ID for the Business Insight Assistant session. Stored per template independently of chart_conversation_id.';

COMMENT ON COLUMN report_templates.insight_results
IS 'Persisted InsightResult[] array. Computed by JS (HyperFormula) from AI-defined formulas. AI never sees actual data values.';
