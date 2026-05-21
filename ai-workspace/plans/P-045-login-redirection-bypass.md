# P-045: Fix Login Redirection and Bypass for Active Sessions - Implementation Plan

## Proposed Changes

### Backend / API Layer

#### [MODIFY] [route.ts](file:///e:/Dev/Next%20JS/kibiai/src/app/api/auth/me/route.ts)
- Expose `companySlug` in the response payload from `/api/auth/me` by grabbing it from `session.companySlug`.

---

### Middleware

#### [MODIFY] [middleware.ts](file:///e:/Dev/Next%20JS/kibiai/middleware.ts)
- Refine Rule 3 (Login Bypass) on localhost:
  ```typescript
  // Rule 3: Login Bypass
  if (pathname.endsWith('/login')) {
    if (user.accountType === 'platform_admin' && !user.companyId) {
      return NextResponse.redirect(new URL('/admin', request.url));
    } else {
      const pathSegments = pathname.split('/').filter(Boolean);
      const pathSlug = pathSegments[0];
      const targetSlug = user.companySlug || (pathSlug && pathSlug !== 'login' && pathSlug !== 'admin' ? pathSlug : null);
      if (targetSlug) {
        return NextResponse.redirect(new URL(`/${targetSlug}`, request.url));
      }
    }
  }
  ```
- Refine Rule 3 (Login Bypass on Subdomain) on production:
  ```typescript
  // Rule 3: Login Bypass on Subdomain
  if (pathname.endsWith('/login')) {
    if (user.accountType === 'platform_admin' && !user.companyId) {
      return NextResponse.redirect(new URL('/', `https://admin.${BASE_DOMAIN}`));
    } else {
      const targetSlug = user.companySlug || subdomain;
      if (targetSlug) {
        return NextResponse.redirect(new URL('/', `https://${targetSlug}.${BASE_DOMAIN}`));
      }
    }
  }
  ```
- Refine the apex domain login bypass rule similarly:
  ```typescript
  // Login bypass for apex
  if (user && pathname.endsWith('/login')) {
    if (user.accountType === 'platform_admin' && !user.companyId) {
      return NextResponse.redirect(new URL('/', `https://admin.${BASE_DOMAIN}`));
    } else {
      const targetSlug = user.companySlug;
      if (targetSlug) {
        return NextResponse.redirect(new URL('/', `https://${targetSlug}.${BASE_DOMAIN}`));
      }
    }
  }
  ```

---

### Frontend Components

#### [MODIFY] [page.tsx](file:///e:/Dev/Next%20JS/kibiai/src/app/%5Bcompany_slug%5D/login/page.tsx) (Company Login Page)
- Import `useAccessControl` from `@/context/AccessControlContext`.
- Add a `useEffect` to watch `accountId` and `isLoading` from `useAccessControl()`.
- If `accountId` is defined and `isLoading` is false, redirect immediately to `/${company_slug}` (which then routes to `/templates`).

#### [MODIFY] [page.tsx](file:///e:/Dev/Next%20JS/kibiai/src/app/login/page.tsx) (Global Login Page)
- Add a `useEffect` that runs once on mount to check `/api/auth/me`.
- If it returns `success: true` and a valid user payload:
  - If `user.accountType === 'platform_admin' && !user.company_id`, redirect to `/admin`.
  - If `user.companySlug` is present, redirect to `/${user.companySlug}` (localhost) or `https://${user.companySlug}.${baseDomain}/` (prod).

---

## Verification Plan

### Automated Tests
- Build check: `npm run build`
- Eslint/Lint check: `npm run lint`

### Manual Verification
1. Log in to a workspace (e.g. `us-spice-mills`).
2. Verify that visiting `https://us-spice-mills.kibiai.itsb3.xyz/login` (or `/us-spice-mills/login` on localhost) immediately redirects back to the home/templates page without flashing the login form.
3. Verify that visiting the global login page `https://kibiai.itsb3.xyz/login` (or `/login` on localhost) redirects to the workspace home page.
4. Log out and ensure normal behavior (the login page is visible, and accessing protected resources redirects back to login).
