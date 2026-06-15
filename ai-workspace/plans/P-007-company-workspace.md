# P-007: Company Workspace Foundation & Multi-Tenant Logic

This plan covers the implementation of the "Second Step" of the platform: Company-specific logic and workspace foundation.

## Phase 1: Infrastructure & Context
- [x] Create `CompanyProvider` to manage tenant state.
- [x] Implement `GET /api/company/resolve/[slug]` endpoint.
- [x] Set up `src/app/[company_slug]/layout.tsx` to wrap workspace routes.

## Phase 2: Authentication & Branding
- [ ] Implement `/[company_slug]/login` page with dynamic logo/branding.
- [ ] Update `auth.service.ts` to support company-bound login.
- [ ] Implement middleware to protect `/[company_slug]/*` routes.

## Phase 3: Company Workspace Dashboard
- [ ] Implement `/[company_slug]/templates` page.
- [ ] Create `ModuleFilter` component to group templates.
- [ ] Implement template fetching with `company_id` filter.

## Phase 4: Company Admin Features
- [ ] Implement `/[company_slug]/admin/staff` for user management.
- [ ] Implement `/[company_slug]/admin/roles` for role management.

## Verification Plan
- [ ] Verify that navigating to `/test-company/login` shows the correct logo.
- [ ] Verify that a user from Company A cannot login to Company B's workspace.
- [ ] Verify that templates are filtered correctly by `company_id`.
- [ ] Run `npm run lint` and `npm run build`.

## References
- `ai-workspace/docs/company_logic_implementation.md`
- `ai-workspace/docs/appilcation_document/application_document.txt`
