# MODULE: COMPANY WORKSPACE (TENANT LEVEL)

## Overview
This module provides the multi-tenant workspace experience for client companies. It handles tenant-specific branding, isolated authentication, and the browsing/generation of reports and charts.

## Core Architecture
- **Dynamic Root**: `src/app/[company_slug]/layout.tsx` (Wraps all tenant routes in `CompanyProvider`).
- **Context Provider**: `src/components/providers/CompanyProvider.tsx` (Provides branding/status).
- **Service Layer**: `src/services/company.service.ts` (Core business logic for resolution).
- **API Surface**: `src/app/api/company/resolve/[slug]/route.ts` (Thin wrapper around CompanyService).
- **Key Routes**:
  - `/[company_slug]/login`: Branded entry point for tenant users.
  - `/[company_slug]/templates`: (Planned) Report template browsing.

## Business Logic: Tenant Resolution
1. **Slug Extraction**: The `company_slug` is extracted from the URL path.
2. **Database Lookup**: Uses `CompanyService.resolveCompanyBySlug`.
   - Normalizes hyphens to spaces.
   - Performs a case-insensitive `ilike` match.
   - Fallback: Uses a fuzzy prefix match (`search%`) to handle variations like trailing dots (e.g., "Inc.").
3. **Status Check**: Only `Active` companies are permitted access to the workspace.
4. **Context Propagation**: Metadata like `company_id`, `company_name`, and `company_logo` are served via React Context to child components.

## Security & Auth
- **Tenant Binding**: Login requests are bound to a specific `company_id`.
- **Identity Isolation**: (In Progress) Ensuring sessions only grant access to data belonging to the resolved `company_id`.
- **Branding**: Logos and names are dynamically injected from the database to ensure a white-labeled experience.

## Database Relationships
- `companies` (1) <-> (M) `report_templates`
- `companies` (1) <-> (M) `reports`
- `companies` (1) <-> (M) `chart_templates`

## Testing & Verification
- **Unit Tests**: `src/services/__tests__/company.service.test.ts` (Vitest). Mocks Supabase client to verify resolution and fuzzy matching logic.
- **E2E Tests**: `tests/company_workspace.spec.ts` (Playwright). Verifies that navigating to a valid slug loads the branded UI and an invalid slug shows a "Workspace Error".

## Common Tasks
- **Updating Branding**: Modifying the `company_logo` or `company_name` in the database will automatically reflect in the workspace.
- **Handling Slugs**: The resolver handles hyphen-to-space normalization and prefix matching. For maximum reliability, a dedicated `slug` column should be added to the `companies` table in the future.
