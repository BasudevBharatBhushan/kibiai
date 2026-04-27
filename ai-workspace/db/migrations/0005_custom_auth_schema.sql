-- Migration: 0005_custom_auth_schema
-- Description: Implement custom JWT auth schema and remove Supabase Auth dependency.

-- 1. Create auth_accounts table
CREATE TABLE IF NOT EXISTS public.auth_accounts (
    account_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email varchar(150) UNIQUE NOT NULL,
    password_hash text NOT NULL,
    account_type varchar(30) NOT NULL, -- 'platform_admin', 'company_user'
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Modify platform_admins to link to auth_accounts
ALTER TABLE public.platform_admins DROP COLUMN IF EXISTS auth_user_id;
ALTER TABLE public.platform_admins ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.auth_accounts(account_id) ON DELETE CASCADE;

-- 3. Modify users to link to auth_accounts
ALTER TABLE public.users DROP COLUMN IF EXISTS auth_user_id;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.auth_accounts(account_id) ON DELETE CASCADE;

-- 4. Enable RLS on auth_accounts
ALTER TABLE public.auth_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Only the account owner can view their own record
CREATE POLICY "Users can view their own auth account"
ON public.auth_accounts
FOR SELECT
TO authenticated
USING (account_id::text = auth.uid()::text); -- This is for future Supabase interop if needed, but we will mostly bypass RLS using Service Role for custom auth logic.

-- 5. Trigger for updated_at
CREATE TRIGGER update_auth_accounts_updated_at
BEFORE UPDATE ON public.auth_accounts
FOR EACH ROW EXECUTE PROCEDURE update_updated_on_column();
