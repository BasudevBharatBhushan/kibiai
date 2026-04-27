# P-004: Custom JWT Auth Implementation Plan

## Phase 1: Database Migration
- [ ] Create `0005_custom_auth_schema.sql`.
- [ ] Implement `auth_accounts` table.
- [ ] Migrate `platform_admins` and `users` tables to use `auth_account_id` instead of `auth_user_id`.
- [ ] Add `UNIQUE` constraint on email across the system.
- [ ] Apply migration on Supabase.

## Phase 2: Dependencies
- [ ] Install `bcryptjs` and `jose`.

## Phase 3: Auth Utilities
- [ ] Create `src/utils/auth.ts` for hashing, JWT signing/verifying, and cookie management.
- [ ] Create a `middleware.ts` for route protection (optional, but recommended).

## Phase 4: API Implementation
- [ ] Create `src/app/api/auth/login/route.ts`.
- [ ] Create `src/app/api/auth/logout/route.ts`.
- [ ] Update `src/app/api/company/route.ts` to create `auth_accounts` during onboarding.

## Phase 5: Frontend Refactoring
- [ ] Update `/admin/page.tsx` to use the new login API instead of `supabase.auth`.
- [ ] Update session checking logic to use JWT cookie.

## Phase 6: Verification
- [ ] Run Playwright tests.
- [ ] Perform `eslint` and `build` checks.
