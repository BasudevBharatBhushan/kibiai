-- Migration: 0003_billing_and_admin_tables
-- Description: Creates the tables needed for replacing FileMaker / Mongo billing and licensing.

-- 1. plans
CREATE TABLE IF NOT EXISTS public.plans (
    plan_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_name varchar(100) UNIQUE NOT NULL,
    plan_price numeric(10,2) NOT NULL DEFAULT 0,
    stripe_product_id varchar(150),
    stripe_response_json jsonb,
    created_on timestamptz DEFAULT now()
);

-- 2. licenses
CREATE TABLE IF NOT EXISTS public.licenses (
    license_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(company_id) ON DELETE CASCADE,
    plan_name varchar(100),
    price numeric(10,2) DEFAULT 0,
    users_limit integer,
    workspaces_limit integer,
    reports_limit integer,
    charts_limit integer,
    ai_features varchar(100),
    licensing_terms varchar(150),
    support_level varchar(100),
    is_active boolean DEFAULT true,
    expiry_date timestamptz,
    created_on timestamptz DEFAULT now(),
    updated_on timestamptz DEFAULT now()
);

-- 3. promocodes
CREATE TABLE IF NOT EXISTS public.promocodes (
    promocode_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code varchar(50) UNIQUE NOT NULL,
    percent_off numeric(5,2) NOT NULL,
    max_redemptions integer,
    redemptions_count integer DEFAULT 0,
    expires_at timestamptz,
    is_active boolean DEFAULT true,
    created_on timestamptz DEFAULT now()
);

-- 4. payment_logs
CREATE TABLE IF NOT EXISTS public.payment_logs (
    payment_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(company_id) ON DELETE CASCADE,
    api_request jsonb,
    api_response jsonb,
    status varchar(50),
    created_on timestamptz DEFAULT now()
);

-- RLS POLICIES FOR NEW TABLES --

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promocodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Plans & Promocodes are mostly read-only for tenant users, managed by Superadmins
-- Wait, let's keep it simple based on the existing pattern: 
-- Anyone can view plans
CREATE POLICY "Allow public read access on plans" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Allow public read access on promocodes" ON public.promocodes FOR SELECT USING (true);

-- Licenses: tenants can only see their own license
CREATE POLICY "Users can view their own company licenses" ON public.licenses 
FOR SELECT USING (company_id = public.get_my_company_id());

CREATE POLICY "Users can manage their own company licenses" ON public.licenses 
FOR ALL USING (company_id = public.get_my_company_id());

-- Payment Logs: tenants can only see their own logs
CREATE POLICY "Users can view their own company payment logs" ON public.payment_logs 
FOR SELECT USING (company_id = public.get_my_company_id());

CREATE POLICY "Users can insert their own company payment logs" ON public.payment_logs 
FOR INSERT WITH CHECK (company_id = public.get_my_company_id());
