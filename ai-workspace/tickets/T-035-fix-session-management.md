# T-035: Fix Session Management and Redirection Rules

## Objective
Implement strict session-based redirection rules across the platform to ensure robust workspace access control and prevent users from accidentally hitting login pages or unauthorized company subdomains when already authenticated.

## Requirements
1. **Rule 1 (Sticky Login):** If a user is already logged in as a platform admin or company user, any hit to the apex domain or an unrelated platform URL should redirect them to their respective workspace dashboard.
2. **Rule 2 (Company Isolation):** For company-based logins, the session MUST save the `company_slug`. If a logged-in user attempts to access a different company's subdomain/URL, they must be redirected back to their currently authenticated company.
3. **Rule 3 (Login Page Bypass):** If a valid session exists, accessing any `/login` route must immediately redirect to the user's home page.
4. **Rule 4 (Logout Redirection):** If logged out, hitting any protected URL (admin or company) must cleanly redirect the user to the respective login page.
5. **Documentation:** Update `agents.md` and frontend structure docs to reflect the new session payload (`companySlug`) and the refined middleware redirection logic.

## Scope
- Frontend: `middleware.ts`
- Backend: `src/app/api/auth/login/route.ts`
- Utils: `src/utils/auth.ts`, `src/utils/agents.md`

## Status
TODO
