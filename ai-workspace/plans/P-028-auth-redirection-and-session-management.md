# Implementation Plan - T-028-auth-redirection-and-session-management

This plan outlines the changes needed to improve authentication flow, session persistence, and role-based access control.

## 1. Extend Session Lifespan
- **Target**: `src/utils/auth.ts`
- **Change**: 
    - Set `SignJWT` expiration to `'30d'`.
    - Set cookie `maxAge` to `60 * 60 * 24 * 30` (30 days).

## 2. Middleware Redirection Logic
- **Target**: `middleware.ts`
- **Change**: 
    - Read `kibiai_session` cookie.
    - If session exists and `accountType === 'platform_admin'`:
        - If the request is NOT on the `admin` subdomain/route, redirect to `admin.${BASE_DOMAIN}` or `/admin`.
    - If no session exists:
        - If the request is for a protected route (not login, not public assets), redirect to login.
        - Handle the root path `/` to redirect to login if no session.

## 3. Base URL Redirection
- **Target**: `src/app/page.tsx`
- **Change**: 
    - Use `getSession()` to check authentication.
    - If authenticated, redirect to the company templates page (current behavior).
    - If NOT authenticated, redirect to `/login` (or the default company login).

## 4. Session Validation API
- **Target**: `src/app/api/auth/validate/route.ts` (New)
- **Logic**: 
    - Call `getSession()`.
    - Return `success: true` and user info if valid.
    - Return `success: false` if invalid/expired.

## 5. Idle Detection and Auto Sign-out
- **Target**: `src/context/AccessControlContext.tsx`
- **Logic**:
    - Add an effect to listen for user activity (mousemove, keydown, click).
    - On activity, reset an idle timer.
    - If idle for a certain threshold (e.g., 30 minutes) OR during initial load:
        - Call `/api/auth/validate`.
        - If invalid, call `/api/auth/logout` and redirect to login.
- **Target**: `src/utils/apiClient.ts`
    - Add a `validateSession` method or integrate validity checks into the `request` method (e.g., handle 401 status by triggering a logout).

## 6. Verification Plan
- [ ] Log in as Platform Admin -> Check if redirected to `/admin`.
- [ ] Log in as Company User -> Check if redirected to `/templates`.
- [ ] Access `/` without login -> Check if redirected to `/login`.
- [ ] Wait for token expiry (test with shorter time) -> Check if auto signed out.
- [ ] Stay idle -> Check if session validation triggers.
