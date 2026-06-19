# P-003: Platform Admin Architecture Implementation Plan

## Phase 1: Database Migration
- [ ] Write `0004_platform_admins.sql` to create the `platform_admins` table.
- [ ] Insert the primary admin (`priya@kibizsystems.com`) into `platform_admins` (requires retrieving their `auth.users` UUID).
- [ ] Execute migration on Supabase.

## Phase 2: Backend Refactoring
- [ ] Update `src/app/api/company/route.ts`. Remove the logic that attempts to find and link the internal admin to newly created companies. Platform Admins will rely on RLS bypass or explicit policies later.

## Phase 3: Frontend Refactoring
- [ ] Update `src/app/admin/page.tsx` `handleLogin`. After `supabase.auth.signInWithPassword`, query `platform_admins` using the returned user ID. If not found, call `supabase.auth.signOut()` and show an "Unauthorized" error.

## Phase 4: Verification
- [ ] Run `npm run lint` and `npm run build` to verify standard compliance.
- [ ] Log completion in execution logs.
