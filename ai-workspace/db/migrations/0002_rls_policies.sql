-- RLS POLICIES FOR KIBIAI
-- Created: 2026-04-24

-- Function to get the company_id for the current authenticated user
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT company_id 
    FROM public.users 
    WHERE auth_user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- policies: companies
--------------------------------------------------------------------------------
CREATE POLICY "Users can view their own company" 
ON companies FOR SELECT 
USING (company_id = public.get_my_company_id());

--------------------------------------------------------------------------------
-- policies: users
--------------------------------------------------------------------------------
CREATE POLICY "Users can view users in their company" 
ON users FOR SELECT 
USING (company_id = public.get_my_company_id());

CREATE POLICY "Users can update their own profile" 
ON users FOR UPDATE 
USING (auth_user_id = auth.uid());

--------------------------------------------------------------------------------
-- policies: roles
--------------------------------------------------------------------------------
CREATE POLICY "Users can view roles in their company" 
ON roles FOR SELECT 
USING (company_id = public.get_my_company_id());

--------------------------------------------------------------------------------
-- policies: modules
--------------------------------------------------------------------------------
CREATE POLICY "Users can view modules in their company" 
ON modules FOR SELECT 
USING (company_id = public.get_my_company_id());

--------------------------------------------------------------------------------
-- policies: report_templates
--------------------------------------------------------------------------------
CREATE POLICY "Users can manage report templates in their company" 
ON report_templates FOR ALL 
USING (company_id = public.get_my_company_id())
WITH CHECK (company_id = public.get_my_company_id());

--------------------------------------------------------------------------------
-- policies: reports
--------------------------------------------------------------------------------
CREATE POLICY "Users can manage reports in their company" 
ON reports FOR ALL 
USING (company_id = public.get_my_company_id())
WITH CHECK (company_id = public.get_my_company_id());

--------------------------------------------------------------------------------
-- policies: chart_templates
--------------------------------------------------------------------------------
CREATE POLICY "Users can manage chart templates in their company" 
ON chart_templates FOR ALL 
USING (company_id = public.get_my_company_id())
WITH CHECK (company_id = public.get_my_company_id());

--------------------------------------------------------------------------------
-- policies: charts
--------------------------------------------------------------------------------
CREATE POLICY "Users can manage charts in their company" 
ON charts FOR ALL 
USING (company_id = public.get_my_company_id())
WITH CHECK (company_id = public.get_my_company_id());

--------------------------------------------------------------------------------
-- policies: ai_usage_logs
--------------------------------------------------------------------------------
CREATE POLICY "Users can view logs in their company" 
ON ai_usage_logs FOR SELECT 
USING (company_id = public.get_my_company_id());

CREATE POLICY "System can insert logs for the company" 
ON ai_usage_logs FOR INSERT 
WITH CHECK (company_id = public.get_my_company_id());
