# Execution Log - T-028-auth-redirection-and-session-management

## Step 1: Extend Session Lifespan
- **Date**: 2026-05-06
- **Changes**: Modified `src/utils/auth.ts` to increase JWT expiration and cookie `maxAge` to 30 days.

## Step 2: Session Validation API
- **Date**: 2026-05-06
- **Changes**: Created `src/app/api/auth/validate/route.ts` to provide a lightweight session check.

## Step 3: Base URL Redirection
- **Date**: 2026-05-06
- **Changes**: Updated `src/app/page.tsx` to check session and redirect to `/login` if not authenticated.

## Step 4: Middleware Redirection Logic
- **Date**: 2026-05-06
- **Changes**: 
    - Added JWT verification to `middleware.ts`.
    - Implemented role-based redirection: Platform admins are forced to the `admin` subdomain.
    - Added auth guard to redirect unauthenticated users to `/login`.

## Step 5: Idle Detection & Auto Logout
- **Date**: 2026-05-06
- **Changes**: 
    - Added activity tracking and periodic session validation in `AccessControlContext.tsx`.
    - Enhanced `apiClient.ts` to handle 401 responses by redirecting to `/login`.
