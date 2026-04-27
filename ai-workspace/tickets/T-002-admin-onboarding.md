# T-002: Admin Module - Company Onboarding

## Status
COMPLETED

## Scope
`fullstack`

## Objective
Implement the Platform Admin Dashboard (`/admin`) to support company onboarding as defined in the application architecture document. Transition the existing static/legacy admin UI to use the new Supabase PostgreSQL database schema.

## Requirements
1. **Database Integration**: Update the backend logic and database layer to use the Supabase `companies`, `users`, and `roles` tables.
   - **Migrate Core Operational Data**: Create and utilize new Supabase tables for `licenses`, `payment_logs`, `promocodes`, and `plans`, moving away from the legacy FileMaker APIs.
2. **Admin UI Refactoring**: Refactor `src/app/admin/page.tsx` and its child components to map to the new database fields (e.g., `company_id` instead of `CompanyID`).
3. **Onboarding Flow**:
   - Create a new company record with plan details.
   - Auto-create two users during onboarding: Client Superadmin and KiBiAI Internal Superadmin.
   - Manage license generation and statuses.
4. **Authentication**: Implement real admin authentication instead of the hardcoded `priya@kibizsystems.com` credentials.

## Linked Plan
`P-002-admin-onboarding.md`
