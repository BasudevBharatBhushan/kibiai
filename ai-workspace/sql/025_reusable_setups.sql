-- Migration: 025_reusable_setups.sql
-- Description: Creates the report_template_setups table and adds setup_id to report_templates.

-- 1. Create the reusable setups table
CREATE TABLE IF NOT EXISTS public.report_template_setups (
    setup_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(company_id) ON DELETE CASCADE,
    module_id uuid NOT NULL REFERENCES public.modules(module_id) ON DELETE CASCADE,
    setup_name varchar(180) NOT NULL,
    setup_json jsonb NOT NULL,
    created_by_user_id uuid REFERENCES public.users(user_id),
    created_on timestamptz DEFAULT now(),
    updated_on timestamptz DEFAULT now()
);

-- 2. Add setup_id to report_templates
ALTER TABLE public.report_templates 
ADD COLUMN IF NOT EXISTS setup_id uuid REFERENCES public.report_template_setups(setup_id) ON DELETE SET NULL;

-- 3. Enable RLS
ALTER TABLE public.report_template_setups ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
CREATE POLICY "Users can view setups in their company" ON public.report_template_setups
    FOR SELECT TO authenticated
    USING (company_id = public.get_my_company_id());

CREATE POLICY "Users can insert setups in their company" ON public.report_template_setups
    FOR INSERT TO authenticated
    WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "Users can update setups in their company" ON public.report_template_setups
    FOR UPDATE TO authenticated
    USING (company_id = public.get_my_company_id())
    WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "Users can delete setups in their company" ON public.report_template_setups
    FOR DELETE TO authenticated
    USING (company_id = public.get_my_company_id());

-- 5. Trigger for updated_on
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_on = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_on
    BEFORE UPDATE ON public.report_template_setups
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Comment: This migration requires public.get_my_company_id() to be already defined (which it is in this project).
