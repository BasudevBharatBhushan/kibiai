-- Migration: 0004_platform_admins
-- Description: Creates the platform_admins table to separate KiBiAI internal admins from company users.

CREATE TABLE IF NOT EXISTS public.platform_admins (
    admin_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email varchar(150) UNIQUE NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Policy: Only Platform Admins can see the admin list
CREATE POLICY "Platform Admins can view platform_admins" 
ON public.platform_admins 
FOR SELECT 
TO authenticated 
USING (auth.uid() IN (SELECT auth_user_id FROM public.platform_admins));
