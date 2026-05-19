# T-007: Company Workspace Foundation & Multi-Tenant Logic

## Status
TODO

## Scope
`fullstack`

## Objective
Establish the foundation for company-specific workspaces, including dynamic routing, tenant context, branded login, and the initial template browsing experience.

## Requirements
1. **Dynamic Routing**: Implement `src/app/[company_slug]` dynamic route structure to handle multi-tenant isolation.
2. **Tenant Resolution**: Middleware or layout-level logic to verify `company_slug` and fetch company metadata.
3. **Branded Login**: Implement `/[company_slug]/login` with dynamic branding (logo/name) based on the tenant.
4. **Company Dashboard (Templates)**: Initial implementation of `/[company_slug]/templates` to list report templates by module.
5. **Context Management**: Create a `CompanyProvider` to serve company-specific state (branding, license status) to child components.
6. **Access Control**: Ensure users are restricted to their own `company_id`.

## Linked Plan
`ai-workspace/plans/P-007-company-workspace.md`
