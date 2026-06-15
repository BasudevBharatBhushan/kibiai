# P-008: Admin UI Enhancement - Company Login URL & Branding

This plan covers the implementation of the Workspace Login URL and Company Logo management features.

## Phase 1: Storage Setup
- [x] Create Supabase Storage bucket `company-logos` with public read access.
- [x] Implement storage RLS policies.

## Phase 2: Login URL Integration
- [x] Update `CompanyDetails.tsx` to include the **Workspace Login** section.
- [x] Implement "Copy" and "Open" functionality.

## Phase 3: Logo Upload Implementation
- [x] Add logo upload field in `CompanyDetails.tsx`.
- [x] Create `api/company/logo` endpoint for upload handling (or use client-side upload if preferred).
- [x] Update `companies` table with the new logo URL.

## Phase 4: Branding Refinement
- [x] Update `src/app/[company_slug]/login/page.tsx` for logo pairing (Company Top + KiBiAI Bottom).
- [x] Update `src/app/[company_slug]/layout.tsx` for header branding (Company Left + KiBiAI Right).

## Verification Plan
- [x] Test URL copy and open.
- [x] Test logo upload and preview.
- [x] Verify branding placement in the workspace.
- [x] Run `npm run lint` and `npm run build`.

## References
- `ai-workspace/docs/frontend-structure.md`
- `src/components/CompanyDetails.tsx`
