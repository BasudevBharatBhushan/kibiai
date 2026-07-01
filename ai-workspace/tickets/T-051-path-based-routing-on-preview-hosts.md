# T-051 — Path-based routing on preview / non-base-domain hosts

**Status:** COMPLETED
**Type:** fix
**Branch:** `fix/T-051-preview-path-routing`

## Problem

Tenant routing currently has exactly two modes:

1. **localhost / LAN** (`localhost`, `127.0.0.1`, `192.168.*`) → path-based (`/[company_slug]/...`)
2. **everything else** → subdomain-based (`<slug>.kibiai.itsb3.xyz`)

Vercel preview deployments (e.g. `https://kibiai-git-test-sql-ki-flow.vercel.app`)
fall into bucket 2. That breaks previews:

- Opening a workspace / logging in redirects the user off the preview host to
  `https://<slug>.kibiai.itsb3.xyz`, leaving the preview entirely.
- The session cookie is set with `Domain=.kibiai.itsb3.xyz`. Browsers **reject** a
  `Set-Cookie` whose `Domain` does not match the current host, so on a `*.vercel.app`
  host the session cookie is silently dropped — login never sticks.

## Desired behaviour

Subdomain routing must apply **only** to the configured base domain and its
subdomains (`kibiai.itsb3.xyz` and `*.kibiai.itsb3.xyz`). Every other host —
localhost, LAN IPs, and preview URLs — must behave exactly like local dev
(path-based routing, host-only cookie).

So on `https://kibiai-git-test-sql-ki-flow.vercel.app`, opening a workspace goes to
`https://kibiai-git-test-sql-ki-flow.vercel.app/kibiz-systems-inc/...` (or its
`/login`), and the session cookie is scoped to that host.

## Acceptance criteria

- [ ] On a `*.vercel.app` (or any non-base-domain) host, no redirect ever targets
      `*.kibiai.itsb3.xyz`.
- [ ] Login on a preview host sets a working (host-only) session cookie.
- [ ] Middleware rewrites `/[company_slug]/...` path-based on preview hosts.
- [ ] Real production (`<slug>.kibiai.itsb3.xyz`) subdomain behaviour is unchanged.
- [ ] localhost behaviour is unchanged.
