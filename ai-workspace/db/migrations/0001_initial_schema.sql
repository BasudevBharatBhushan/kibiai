-- INITIAL SCHEMA FOR KIBIAI
-- Created: 2026-04-24

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to update updated_on timestamp
CREATE OR REPLACE FUNCTION update_updated_on_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_on = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

--------------------------------------------------------------------------------
-- companies
--------------------------------------------------------------------------------
CREATE TABLE companies (
    company_id        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name      varchar(150)  NOT NULL,
    company_logo      text,
    company_address   text,
    license_key       varchar(100)  UNIQUE,
    plan_code         varchar(50),
    status            varchar(20)   DEFAULT 'Active', -- Active / Inactive / Suspended
    created_on        timestamptz   DEFAULT now(),
    updated_on        timestamptz   DEFAULT now()
);

CREATE TRIGGER update_companies_updated_on
BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE PROCEDURE update_updated_on_column();

--------------------------------------------------------------------------------
-- users
--------------------------------------------------------------------------------
CREATE TABLE users (
    user_id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id      uuid          UNIQUE, -- Reference to auth.users(id)
    company_id        uuid          REFERENCES companies(company_id) ON DELETE CASCADE,
    user_email        varchar(150)  NOT NULL,
    full_name         varchar(150),
    designation       varchar(120),
    user_status       varchar(20)   DEFAULT 'Invited', -- Active / Invited / Disabled
    created_on        timestamptz   DEFAULT now(),
    updated_on        timestamptz   DEFAULT now()
);

CREATE TRIGGER update_users_updated_on
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE PROCEDURE update_updated_on_column();

--------------------------------------------------------------------------------
-- roles
--------------------------------------------------------------------------------
CREATE TABLE roles (
    role_id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        uuid          REFERENCES companies(company_id) ON DELETE CASCADE,
    role_name         varchar(80)   NOT NULL,
    is_super_admin    boolean       DEFAULT false,
    created_on        timestamptz   DEFAULT now()
);

--------------------------------------------------------------------------------
-- modules
--------------------------------------------------------------------------------
CREATE TABLE modules (
    module_id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        uuid          REFERENCES companies(company_id) ON DELETE CASCADE,
    module_name       varchar(120)  NOT NULL,
    module_code       varchar(60)   NOT NULL,
    module_status     varchar(20)   DEFAULT 'Active', -- Active / Archived
    created_on        timestamptz   DEFAULT now()
);

--------------------------------------------------------------------------------
-- report_templates
--------------------------------------------------------------------------------
CREATE TABLE report_templates (
    report_template_id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                  uuid          REFERENCES companies(company_id) ON DELETE CASCADE,
    module_id                   uuid          REFERENCES modules(module_id) ON DELETE SET NULL,
    report_template_name        varchar(180)  NOT NULL,
    conversation_id             varchar(120),
    report_template_setup_json  jsonb,
    report_template_config_json jsonb,
    report_template_data_json   jsonb,
    report_template_insight     text,
    report_template_status      varchar(20)   DEFAULT 'Draft', -- Draft / Active / Archived
    version_number              integer       DEFAULT 1,
    created_by_user_id          uuid          REFERENCES users(user_id) ON DELETE SET NULL,
    created_on                  timestamptz   DEFAULT now(),
    updated_on                  timestamptz   DEFAULT now()
);

CREATE TRIGGER update_report_templates_updated_on
BEFORE UPDATE ON report_templates
FOR EACH ROW EXECUTE PROCEDURE update_updated_on_column();

--------------------------------------------------------------------------------
-- reports
--------------------------------------------------------------------------------
CREATE TABLE reports (
    report_id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid          REFERENCES companies(company_id) ON DELETE CASCADE,
    report_template_id      uuid          REFERENCES report_templates(report_template_id) ON DELETE CASCADE,
    report_name             varchar(180)  NOT NULL,
    report_config_json      jsonb,
    report_data_json        jsonb,
    report_insight          text,
    generated_by_user_id    uuid          REFERENCES users(user_id) ON DELETE SET NULL,
    created_on              timestamptz   DEFAULT now()
);

--------------------------------------------------------------------------------
-- chart_templates
--------------------------------------------------------------------------------
CREATE TABLE chart_templates (
    chart_template_id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                  uuid          REFERENCES companies(company_id) ON DELETE CASCADE,
    report_template_id          uuid          REFERENCES report_templates(report_template_id) ON DELETE CASCADE,
    conversation_id             varchar(120),
    chart_template_name         varchar(180)  NOT NULL,
    chart_template_type         varchar(40),  -- Bar / Line / Pie / Donut / Area
    chart_template_setup_json   jsonb,
    chart_template_dataset_json jsonb,
    chart_template_canvas_state jsonb,
    chart_template_status       varchar(20)   DEFAULT 'Draft', -- Draft / Active / Archived
    version_number              integer       DEFAULT 1,
    created_on                  timestamptz   DEFAULT now(),
    updated_on                  timestamptz   DEFAULT now()
);

CREATE TRIGGER update_chart_templates_updated_on
BEFORE UPDATE ON chart_templates
FOR EACH ROW EXECUTE PROCEDURE update_updated_on_column();

--------------------------------------------------------------------------------
-- charts
--------------------------------------------------------------------------------
CREATE TABLE charts (
    chart_id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid          REFERENCES companies(company_id) ON DELETE CASCADE,
    chart_template_id       uuid          REFERENCES chart_templates(chart_template_id) ON DELETE CASCADE,
    report_id               uuid          REFERENCES reports(report_id) ON DELETE CASCADE,
    chart_name              varchar(180)  NOT NULL,
    chart_type              varchar(40),
    chart_json              jsonb,
    duplicate_of_chart_id   uuid          REFERENCES charts(chart_id) ON DELETE SET NULL,
    created_by_user_id      uuid          REFERENCES users(user_id) ON DELETE SET NULL,
    created_on              timestamptz   DEFAULT now()
);

--------------------------------------------------------------------------------
-- ai_usage_logs
--------------------------------------------------------------------------------
CREATE TABLE ai_usage_logs (
    ai_usage_log_id   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        uuid          REFERENCES companies(company_id) ON DELETE CASCADE,
    user_id           uuid          REFERENCES users(user_id) ON DELETE SET NULL,
    entity_type       varchar(30),  -- Report / Chart / Template
    entity_id         uuid,
    model_name        varchar(80),
    input_tokens      integer       DEFAULT 0,
    output_tokens     integer       DEFAULT 0,
    created_on        timestamptz   DEFAULT now()
);
