-- =============================================================================
-- Migration: 014_allowed_subdomains.sql
-- Description: Creates the allowed_subdomains table which acts as the registry
--              of valid company subdomains for the KiBiAI platform.
--
-- NOTE: The "admin" subdomain is RESERVED and is NOT stored in this table.
--       It is hardcoded in the middleware as a platform-level reserved keyword.
--
-- RESERVED slugs (must also be blocked at company creation in application code):
--   admin, api, www, kibiai, app, mail, ftp, support, help, static, assets
--
-- HOW TO RUN: Execute this entire script in the Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Create the allowed_subdomains table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.allowed_subdomains (
  subdomain_id  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          varchar(120) NOT NULL UNIQUE,  -- kebab-case company slug (e.g. "acme-corp")
  company_id    uuid         NOT NULL REFERENCES public.companies(company_id) ON DELETE CASCADE,
  is_active     boolean      NOT NULL DEFAULT true,
  created_on    timestamptz  NOT NULL DEFAULT now(),
  updated_on    timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.allowed_subdomains IS
  'Registry of valid company subdomains. Used by Next.js middleware to validate subdomain routing. The "admin" subdomain is reserved and not stored here.';

COMMENT ON COLUMN public.allowed_subdomains.slug IS
  'Kebab-case slug derived from company_name. Must be unique across all companies. Example: "acme-corp"';

COMMENT ON COLUMN public.allowed_subdomains.is_active IS
  'When false, the subdomain is blocked even if the slug exists. Set to false when a company is deactivated.';

-- -----------------------------------------------------------------------------
-- 2. Index for fast slug lookups (called on every non-localhost request)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_allowed_subdomains_slug
  ON public.allowed_subdomains (slug)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_allowed_subdomains_company
  ON public.allowed_subdomains (company_id);

-- -----------------------------------------------------------------------------
-- 3. Enable Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.allowed_subdomains ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 4. RLS Policies
-- -----------------------------------------------------------------------------

-- Public read: The middleware validation API is unauthenticated.
-- Only active subdomains are readable.
CREATE POLICY "allowed_subdomains_public_read"
  ON public.allowed_subdomains
  FOR SELECT
  USING (is_active = true);

-- Write operations: Handled exclusively by the service role (admin client).
-- No additional policies needed — service role bypasses RLS by default.

-- -----------------------------------------------------------------------------
-- 5. Auto-update updated_on trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_allowed_subdomains_updated_on()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_on = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_allowed_subdomains_updated_on
  BEFORE UPDATE ON public.allowed_subdomains
  FOR EACH ROW
  EXECUTE FUNCTION public.update_allowed_subdomains_updated_on();

-- -----------------------------------------------------------------------------
-- 6. Backfill existing companies (optional — run if companies already exist)
--    Derives slug from company_name using the same normalization as the app:
--    lowercase, trim, replace spaces with hyphens, remove special chars.
-- -----------------------------------------------------------------------------
-- INSERT INTO public.allowed_subdomains (slug, company_id, is_active)
-- SELECT
--   lower(regexp_replace(trim(company_name), '[^a-zA-Z0-9\s-]', '', 'g'))
--     |> regexp_replace('\s+', '-', 'g') AS slug,
--   company_id,
--   (status = 'Active') AS is_active
-- FROM public.companies
-- ON CONFLICT (slug) DO NOTHING;

-- NOTE: The backfill above is commented out because the slug normalization
--       must exactly match what the application code produces. Un-comment and
--       test after Step 5 (application sync logic) is implemented and verified.

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
