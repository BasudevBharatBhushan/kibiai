-- Migration: Create Admin Workspace Permission Tables

-- Table: user_module_access
CREATE TABLE IF NOT EXISTS public.user_module_access (
    user_id uuid NOT NULL,
    module_id uuid NOT NULL,
    company_id uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, module_id),
    CONSTRAINT fk_user_module_access_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_module_access_module FOREIGN KEY (module_id) REFERENCES public.modules(module_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_module_access_company FOREIGN KEY (company_id) REFERENCES public.companies(company_id) ON DELETE CASCADE
);

-- Table: user_template_permissions
CREATE TABLE IF NOT EXISTS public.user_template_permissions (
    user_id uuid NOT NULL,
    report_template_id uuid NOT NULL,
    company_id uuid NOT NULL,
    can_generate_report boolean DEFAULT false,
    can_modify_template boolean DEFAULT false,
    can_create_template boolean DEFAULT false,
    can_delete_template boolean DEFAULT false,
    can_create_charts boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, report_template_id),
    CONSTRAINT fk_user_template_perms_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_template_perms_template FOREIGN KEY (report_template_id) REFERENCES public.report_templates(report_template_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_template_perms_company FOREIGN KEY (company_id) REFERENCES public.companies(company_id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.user_module_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_template_permissions ENABLE ROW LEVEL SECURITY;

-- Create Policies for user_module_access
CREATE POLICY "Users can view their company's module access"
ON public.user_module_access FOR SELECT
USING (company_id = (SELECT company_id FROM public.users WHERE user_id = auth.uid() OR account_id = auth.uid() LIMIT 1));

CREATE POLICY "Users can manage their company's module access"
ON public.user_module_access FOR ALL
USING (company_id = (SELECT company_id FROM public.users WHERE user_id = auth.uid() OR account_id = auth.uid() LIMIT 1));

-- Create Policies for user_template_permissions
CREATE POLICY "Users can view their company's template permissions"
ON public.user_template_permissions FOR SELECT
USING (company_id = (SELECT company_id FROM public.users WHERE user_id = auth.uid() OR account_id = auth.uid() LIMIT 1));

CREATE POLICY "Users can manage their company's template permissions"
ON public.user_template_permissions FOR ALL
USING (company_id = (SELECT company_id FROM public.users WHERE user_id = auth.uid() OR account_id = auth.uid() LIMIT 1));
