# T-014: Subdomain-Based Routing for Production

## Status: COMPLETED ✅

## Type: fullstack

## Summary
Implement subdomain-based routing for production so that:
- `admin.kibiai.itsb3.xyz` → `/admin` (Platform Admin Panel)
- `<company_slug>.kibiai.itsb3.xyz` → `/[company_slug]` (Company Workspace)
- Any unknown subdomain → Error page (Invalid subdomain)
- Localhost behavior remains unchanged (path-based routing)

A Supabase table `allowed_subdomains` will be maintained to whitelist valid company slugs and the reserved admin subdomain. The Next.js middleware will enforce subdomain resolution.

## Goals
1. Implement Next.js middleware subdomain resolution logic.
2. Create `allowed_subdomains` DB table to track valid slugs.
3. Add SQL migration for the new table with appropriate RLS.
4. Implement a public-facing "Invalid Subdomain" error page.
5. Update the admin panel to display its subdomain link.
6. Sync `allowed_subdomains` when a new company is onboarded via the Admin Panel.
7. Ensure localhost (dev) still uses path-based routing unaffected.

## Scope
- `fullstack` (middleware, DB, API, frontend error page, admin UI link)

## Related Plans
- P-014-subdomain-routing.md

## Dependencies
- Existing: `src/app/admin/`, `src/app/[company_slug]/`
- DB: `companies` table (slug source), new `allowed_subdomains` table
- Domains: `kibiai.itsb3.xyz` + `*.kibiai.itsb3.xyz` (wildcard already configured)

## Acceptance Criteria
- [ ] `admin.kibiai.itsb3.xyz` resolves to `/admin` in production
- [ ] `<valid_slug>.kibiai.itsb3.xyz` resolves to `/[company_slug]`
- [ ] Unknown subdomains show a dedicated error page
- [ ] Localhost remains path-based (no subdomain logic applied)
- [ ] `allowed_subdomains` table is seeded when a company is created
- [ ] Admin panel shows a clickable subdomain link per company
- [ ] ESLint and build pass after implementation
