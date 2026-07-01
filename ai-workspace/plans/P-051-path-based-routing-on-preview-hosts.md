# P-051 — Path-based routing on preview / non-base-domain hosts

Ticket: T-051

## Core idea

Replace every scattered `isLocalhost` check with a single shared predicate:

> **Subdomain routing applies only when the host is the base domain or a subdomain
> of it.** Everything else is path-based.

This subsumes the existing localhost check (localhost is not the base domain, so it
is automatically path-based) and adds preview hosts for free.

## New shared helper

`src/lib/utils/hostRouting.ts` (pure string logic — edge- and browser-safe):

```ts
export function usesSubdomainRouting(hostname: string, baseDomain?: string | null): boolean
export function usesPathRouting(hostname: string, baseDomain?: string | null): boolean
```

`usesSubdomainRouting` → `host === base || host.endsWith('.' + base)` (port-stripped,
lowercased). Returns `false` when `baseDomain` is empty. `usesPathRouting` is its
inverse.

## Edits

1. **`middleware.ts`**
   - Change the dev-branch guard (currently `hostname.includes("localhost") || ...`)
     to `usesPathRouting(hostname, BASE_DOMAIN)`. The whole existing path-based block
     then serves previews too (it already uses only relative redirects).
   - `clearStaleCookies`: only add the `Domain=.${BASE_DOMAIN}` variant when the
     request host is actually under `BASE_DOMAIN` (pass hostname in).

2. **`src/utils/auth.ts` — `createSession`** *(the login-breaking bug)*
   - Add the `domain: .${domain}` cookie attribute only when the request `host`
     is under `domain` (reuse the `host` it already reads). Otherwise set a
     host-only cookie so previews/localhost work.
   - `deleteSession`: read `host` from `headers()` and apply the same guard.

3. **`src/app/api/auth/logout/route.ts`**
   - Guard the domain-scoped clear with the same host check (read `host` via
     `headers()`), so we don't emit a mismatched-domain cookie on previews.

4. **`src/app/login/page.tsx`**
   - Replace `isLocalhost` with `pathBased = usesPathRouting(hostname, domain)`.
   - Session-check redirects and `handleGo` use relative paths when `pathBased`.
   - Input prefix: show `window.location.host + '/'` when `pathBased` (instead of the
     hardcoded `localhost:3000/`), keep `https:// … .baseDomain` for real subdomains.

5. **`src/components/CompanyDetails.tsx`**
   - Replace `isLocalhost` with `pathBased`. Path-based workspace URL uses
     `window.location.origin`. Keep the production subdomain display only when NOT
     path-based.

6. **`src/components/layout/Header.tsx`**
   - Replace the inline `isLocalhost` logout check with `usesPathRouting(...)`.

## Non-goals / unchanged

- Real production subdomain flows (`<slug>.kibiai.itsb3.xyz`).
- Slug validation, admin routing, RESERVED_* handling.

## Test plan (TEST-051)

- Unit: `usesSubdomainRouting` / `usesPathRouting` truth table
  (`kibiai.itsb3.xyz`, `acme.kibiai.itsb3.xyz`, `*.vercel.app`, `localhost:3000`,
  `127.0.0.1`, empty base).
- Manual/E2E on preview host: login sets cookie, workspace open stays on preview
  host with path-based URL, no redirect to `*.kibiai.itsb3.xyz`.
- Regression: localhost and a simulated `<slug>.kibiai.itsb3.xyz` host still behave
  as today.

## Risk

Low. Additive helper; each edit is the inverse-equivalent of an existing localhost
branch. The only behavioural change on real prod hosts is nil (they satisfy
`usesSubdomainRouting`).
