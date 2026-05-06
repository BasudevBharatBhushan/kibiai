# Ticket: T-029-fix-company-resolution-by-slug

## Description
Fix the company resolution logic to correctly handle slugs for companies with special characters in their names. The current implementation relies on heuristic matching of `company_name`, which is fragile and fails for cases like "U.S. Spice Mills".

## Goals
1. Update `CompanyService.resolveCompanyBySlug` to query the `allowed_subdomains` table.
2. Ensure that once a company ID is retrieved from `allowed_subdomains`, the full company details are fetched from the `companies` table.
3. Validate that slugs like `us-spice-mills` correctly resolve to the `U.S. Spice Mills` workspace.

## Scope
- **Backend**: `src/services/company.service.ts`

## Tasks
- [x] Modify `resolveCompanyBySlug` in `src/services/company.service.ts` to use `allowed_subdomains`.
- [x] Implement fallback to the old heuristic matching for backward compatibility if necessary (optional but recommended for safety).
- [x] Verify resolution works for "U.S. Spice Mills" (slug: `us-spice-mills`).

## Status
- **Status**: `COMPLETED`
- **Assigned to**: Antigravity
- **Created**: 2026-05-06
