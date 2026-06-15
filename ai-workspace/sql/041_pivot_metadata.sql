ALTER TABLE report_templates
ADD COLUMN IF NOT EXISTS report_template_pivot_metadata_json jsonb
DEFAULT '{"rows":[],"columns":[],"values":[]}'::jsonb;
