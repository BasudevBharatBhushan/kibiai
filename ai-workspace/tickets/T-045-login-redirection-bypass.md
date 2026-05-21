# T-045: Fix Login Redirection and Bypass for Active Sessions

## Objective
Ensure that if a user has a valid active session, accessing the login pages (both the company-specific login page and the global login page) automatically redirects them to their respective home/dashboard page, rather than displaying the login forms.

## Requirements
1. **Middleware Updates (`middleware.ts`)**:
   - Refine the login bypass redirect rule so that it works reliably on both subdomains (production) and path-based URLs (localhost).
   - Fall back to the subdomain or path slug if `user.companySlug` is not defined in the session, allowing a redirect to the current workspace context.
2. **API Update (`src/app/api/auth/me/route.ts`)**:
   - Include the `companySlug` field in the user metadata returned by `/api/auth/me` so client-side code has access to it.
3. **Client-Side Login Page Protection**:
   - In the company-branded login page (`src/app/[company_slug]/login/page.tsx`), use `useAccessControl()` to check if a valid session exists. If the user is logged in, redirect them to their company home page.
   - In the global login page (`src/app/login/page.tsx`), use a `useEffect` fetch call to `/api/auth/me`. If a valid session exists, redirect them to their company workspace (`/${user.companySlug}`) or the admin dashboard (`/admin`) accordingly.

## Scope
- Frontend: `middleware.ts`, `src/app/[company_slug]/login/page.tsx`, `src/app/login/page.tsx`
- Backend/API: `src/app/api/auth/me/route.ts`

## Status
COMPLETED
