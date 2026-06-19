ALTER TABLE report_templates
  ADD COLUMN IF NOT EXISTS chart_conversation_id varchar(120);

COMMENT ON COLUMN report_templates.chart_conversation_id IS
  'AI thread ID for the Chart Builder session associated with this template.';
