# P-035: Fix Session Management and Redirection Rules Implementation Plan

## Phase 1: Update Auth Payload and Login API
1. **`src/utils/auth.ts`**:
   - Update the `UserPayload` interface to include `companySlug?: string`.

2. **`src/app/api/auth/login/route.ts`**:
   - After resolving `sessionCompanyId`, query the `companies` table using Supabase to fetch the associated `slug`.
   - Update the `createSession` payload to pass `companySlug` so it's included in the JWT.

## Phase 2: Update Middleware Rules (`middleware.ts`)
1. **Rule 3 (Login Bypass)**:
   - Within `middleware.ts`, if `user` exists and `isPublicRoute` is true (e.g., they hit `/login`), immediately redirect them based on their profile.
     - `platform_admin` without a `companyId` -> redirect to `/admin`.
     - User with `companySlug` -> redirect to `/{companySlug}` (localhost) or `https://{companySlug}.{domain}/` (prod).

2. **Rule 2 (Company Isolation)**:
   - Identify the requested environment (localhost vs prod).
   - If `user.companySlug` exists:
     - **On Prod**: If `subdomain` is valid, is not `'admin'`, and does not equal `user.companySlug`, redirect them to `https://{user.companySlug}.{domain}{pathname}`.
     - **On Localhost**: If the path starts with `/[slug]` where slug is not `'admin'` and not equal to `user.companySlug`, redirect to `/{user.companySlug}`.

3. **Rule 4 (Logout Redirection)**:
   - This is mostly handled by `if (!user && !isPublicRoute)`, which redirects to `/login`. Ensure it redirects to the *respective* login page. On localhost: `/${requestedSlug}/login` (or `/admin/login`). On prod: the relative `/login` is fine since they're already on the correct subdomain, keeping them in context.

## Phase 3: Documentation and Active Ticket State
1. Update `src/utils/agents.md` to reflect the updated `companySlug` in the JWT payload and the middleware's strict routing logic.
2. Ensure no regression occurs with the platform admin's auto-company-login flow.
3. Set `ai-workspace/active-ticket` to `T-035-fix-session-management`.
