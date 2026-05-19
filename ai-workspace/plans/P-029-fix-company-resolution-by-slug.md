# Implementation Plan: P-029-fix-company-resolution-by-slug

## Objective
Fix the "Workspace Error: Company not found" issue by using the `allowed_subdomains` table as the source of truth for resolving company slugs.

## Proposed Changes

### 1. `src/services/company.service.ts`
- Modify `resolveCompanyBySlug(slug: string)`:
    - First, query `allowed_subdomains` where `slug = slug` and `is_active = true`.
    - If a match is found, use the `company_id` to fetch company details from `companies`.
    - Keep the existing heuristic matching as a fallback for robustness (though `allowed_subdomains` should be populated for all active companies).

### 2. Create `src/services/agents.md`
- Document the `CompanyService` and other services in this directory.

## Verification Plan

### Automated Tests
- I will create a temporary test script in `/tmp/test-resolution.ts` to verify the `CompanyService.resolveCompanyBySlug` method.
- Test cases:
    - `us-spice-mills` -> should resolve to `U.S. Spice Mills`.
    - `kibiz-systems-inc` -> should resolve to `KiBiz Systems Inc.`.
    - `non-existent-slug` -> should return `null`.

### Manual Verification
- The user can verify by visiting `https://us-spice-mills.kibiai.itsb3.xyz/login` after deployment (or I can simulate the API call).

## Safety Measures
- Use `adminClient` to bypass RLS since this is a platform-level resolution service.
- Maintain fallback logic to prevent breaking existing workspaces that might not be in `allowed_subdomains` yet (though they should be).
