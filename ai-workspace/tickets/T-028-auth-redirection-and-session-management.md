# Ticket: T-028-auth-redirection-and-session-management

## Description
Refine authentication flow, session management, and role-based redirection to ensure security and a seamless user experience.

## Goals
1.  **Platform Admin Redirection**: Automatically redirect platform admins to the admin portal (`/admin`) regardless of the route they attempt to access.
2.  **Base URL Redirection**: Update the root URL (`/`) to redirect to the login page if the user is not authenticated, instead of a hardcoded template page.
3.  **Extended Session Life**: Increase the session token (JWT) and cookie lifespan to 30 days.
4.  **Automatic Sign-out**: Implement checks during page load and after periods of inactivity to automatically sign out users if their token is expired or invalid.

## Scope
- **Frontend**: `src/app/page.tsx`, `src/utils/apiClient.ts`, `src/context/AccessControlContext.tsx`
- **Backend/Shared**: `src/utils/auth.ts`, `middleware.ts`, `src/app/api/auth/validate/route.ts` (New)

## Tasks
- [x] Extend JWT and cookie lifespan to 30 days in `src/utils/auth.ts`.
- [x] Implement session-aware redirection in `middleware.ts` for platform admins.
- [x] Update `src/app/page.tsx` to redirect to login if not authenticated.
- [x] Create `/api/auth/validate` endpoint to check session validity.
- [x] Add idle detection and automatic sign-out logic in the frontend.
- [x] Verify all redirection scenarios.

## Status
- **Status**: `COMPLETED`
- **Assigned to**: Antigravity
- **Created**: 2026-05-06
