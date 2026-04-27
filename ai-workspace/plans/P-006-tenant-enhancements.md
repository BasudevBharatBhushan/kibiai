# Implementation Plan - P-006: Tenant Enhancements

## 1. Context Analysis
- Current onboarding creates a company and a user but doesn't link them to a role via a `role_id` column in the `users` table.
- Company name uniqueness is not strictly enforced in the onboarding API.
- UI lacks explanation for the purpose of "Company Auth Email/Password".

## 2. Proposed Changes
### Database (Migration)
- [x] Add `role_id` (uuid, FK to roles) to `users` table.
- [x] Update `db-architecture.md`.

### Backend (API)
- [x] Update `POST /api/company`:
  - Check for existing company name.
  - Create `Client Superadmin` role for the company.
  - Create user with `role_id`.

### Frontend (UI)
- [x] Update `CompanyList.tsx`:
  - Add informational note about auth credentials.
  - Add client-side duplicate name check.
- [x] Update `CompanyDetails.tsx`:
  - Add informational note about auth credentials.
- [x] Update `LicenseInfo.tsx`:
  - Standardize plan naming (uppercase).

## 3. Verification Plan
- [ ] Run Playwright tests to ensure onboarding still works.
- [ ] Manually verify UI notes and duplicate name prevention.
