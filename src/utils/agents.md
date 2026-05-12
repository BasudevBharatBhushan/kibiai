# Agents: Auth Utilities (`src/utils/auth.ts`)

## Architecture
The platform uses a **Subdomain-Based Multi-tenant Authentication** strategy.

### Session Management
- **Token**: JWT (JSON Web Token) containing `accountId`, `email`, `accountType`, `companyId`, and importantly, `companySlug`.
- **Storage**: `httpOnly`, `secure` (in production) cookies.
- **Cookie Name**: `kibiai_session`.
- **Domain**: In production, cookies are set on the apex domain (e.g., `.kibiai.itsb3.xyz`) to allow the session to persist across different subdomains (e.g., from `kibiai.itsb3.xyz` to `admin.kibiai.itsb3.xyz`).

## Strict Redirection Rules (T-035)
1. **Rule 1 (Sticky Login):** If a user is already logged in as a platform admin or company user, any hit to the apex domain or an unrelated platform URL will redirect them to their respective workspace dashboard.
2. **Rule 2 (Company Isolation):** For company-based logins, the session MUST save the `companySlug`. If a logged-in user attempts to access a different company's subdomain/URL, they must be redirected back to their currently authenticated company.
3. **Rule 3 (Login Page Bypass):** If a valid session exists, accessing any `/login` route must immediately redirect to the user's home page.
4. **Rule 4 (Logout Redirection):** If logged out, hitting any protected URL (admin or company) must cleanly redirect the user to the respective login page.

## Key Logic

### `createSession(payload: UserPayload)`
Encodes the user payload into a JWT and sets the cookie. 
- **Production**: Sets the `domain` flag to `.${NEXT_PUBLIC_BASE_DOMAIN}`.
- **Localhost**: Does not set a domain flag to avoid browser cookie conflicts on port-based development.

### `deleteSession()`
Clears the session.
- **CRITICAL**: Because the cookie is set with a domain in production, it **MUST** be cleared using the same domain flag. Using `cookieStore.delete(name)` without options may fail to clear domain-level cookies. 
- **Implementation**: Uses `cookieStore.set(name, '', { maxAge: 0, domain: ... })` to ensure expiration across the entire domain.

### `getSession()`
Retrieves and verifies the JWT from the cookie. Returns `null` if the token is missing or invalid.

## Security Considerations
- `httpOnly`: Prevents XSS from accessing the session token.
- `secure`: Ensures cookies are only sent over HTTPS.
- `sameSite: 'lax'`: Provides a balance between CSRF protection and allowing cross-subdomain navigation.

## Related Modules
- `middleware.ts`: Uses these utilities to guard routes and perform subdomain rewrites.
- `src/app/api/auth/`: API endpoints that invoke these utility functions.
