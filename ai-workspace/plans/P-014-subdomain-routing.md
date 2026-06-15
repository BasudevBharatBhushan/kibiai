# P-014: Subdomain-Based Routing

**Ticket**: T-014-subdomain-routing.md  
**Scope**: fullstack  
**Status**: AWAITING APPROVAL

---

## Overview

This plan transforms the KiBiAI routing strategy so that in **production**, each logical section of the app is served under its own subdomain, while **localhost (dev)** continues using path-based routing unchanged.

### Domain Mapping

| Subdomain (Production) | Maps To (Internally) | Description |
|---|---|---|
| `admin.kibiai.itsb3.xyz` | `/admin` | Platform Admin Panel |
| `<slug>.kibiai.itsb3.xyz` | `/[company_slug]` | Company Workspace (any valid slug) |
| `kibiai.itsb3.xyz` (apex) | `/` (marketing/default) | Main landing/login |
| `<unknown>.kibiai.itsb3.xyz` | `/invalid-subdomain` | Error page |

---

## Architecture Design

### How It Works (Next.js Middleware Rewrite)

The core mechanism is **URL rewriting** in `middleware.ts`. The app is deployed as a single Next.js instance. When a request arrives, the middleware:
1. Reads the `Host` header.
2. Extracts the subdomain component.
3. Skips subdomain logic if running on `localhost`.
4. Validates the subdomain against the `allowed_subdomains` table.
5. Rewrites the URL path transparently (the browser URL stays the same).

```
Browser: admin.kibiai.itsb3.xyz/dashboard
Middleware rewrites to: /admin/dashboard (internal)
Browser still shows: admin.kibiai.itsb3.xyz/dashboard ✓
```

### Allowed Subdomains Registry

A lightweight Supabase table `allowed_subdomains` acts as the source of truth for valid subdomains. This avoids expensive DB lookups on every request by leveraging an **in-memory validation pattern** and **reserved keywords**.

```
Reserved: "admin" → Always maps to /admin
Dynamic:  <company_slug> → Must exist in allowed_subdomains table
Unknown:  → Redirect to /invalid-subdomain
```

---

## Implementation Steps

---

### Step 1: SQL Migration — `allowed_subdomains` Table

**File**: `ai-workspace/sql/014_allowed_subdomains.sql`

```sql
-- Table: allowed_subdomains
-- Stores valid company subdomains for the KiBiAI platform.
-- The "admin" subdomain is RESERVED and NOT stored here.

CREATE TABLE IF NOT EXISTS public.allowed_subdomains (
  subdomain_id   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           varchar(120) NOT NULL UNIQUE,
  company_id     uuid    NOT NULL REFERENCES public.companies(company_id) ON DELETE CASCADE,
  is_active      boolean NOT NULL DEFAULT true,
  created_on     timestamptz NOT NULL DEFAULT now(),
  updated_on     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_allowed_subdomains_slug ON public.allowed_subdomains(slug);

ALTER TABLE public.allowed_subdomains ENABLE ROW LEVEL SECURITY;

-- Public read for middleware slug validation (unauthenticated)
CREATE POLICY "allowed_subdomains_public_read"
  ON public.allowed_subdomains
  FOR SELECT
  USING (is_active = true);
```

> **Developer Action Required**: Execute in Supabase SQL Editor.

---

### Step 2: API Route — Validate Subdomain

**File**: `src/app/api/subdomains/validate/route.ts`

A lightweight, **public** (no auth required) API route that the middleware calls.

- `GET /api/subdomains/validate?slug=acme-corp`
- Returns `{ valid: true }` or `{ valid: false }`
- Uses `createAdminClient()` to bypass RLS.
- Next.js `fetch` cache applied (60s TTL) to reduce DB load.
- The `admin` slug is hardcoded as always valid.

---

### Step 3: Next.js Middleware

**File**: `src/middleware.ts` (new file at project root)

**Logic Flow**:

```
Request arrives
│
├── Is Host localhost/127.0.0.1? → Skip, continue
│
├── Extract subdomain from Host header
│   "acme-corp.kibiai.itsb3.xyz" → subdomain = "acme-corp"
│   "kibiai.itsb3.xyz" (apex) → no rewrite, continue
│
├── subdomain = "admin"
│   → NextResponse.rewrite(/admin{pathname})
│
├── subdomain = <valid slug> (validated via /api/subdomains/validate)
│   → NextResponse.rewrite(/{slug}{pathname})
│
└── subdomain = <unknown>
    → NextResponse.rewrite(/invalid-subdomain)
```

**Key Details**:
- `NextResponse.rewrite()` — browser URL stays unchanged ✓
- Base domain from `process.env.NEXT_PUBLIC_BASE_DOMAIN`
- `matcher` excludes `_next/static`, `_next/image`, `favicon.ico`
- In-memory module-level Set for slug caching (refreshes every 60s)
- **Reserved slugs blocked** at company creation: `admin`, `api`, `www`

---

### Step 4: Invalid Subdomain Error Page

**File**: `src/app/invalid-subdomain/page.tsx`

Branded, user-friendly error page:
- KiBiAI logo
- "Workspace Not Found" heading
- Explanation text
- CTA: "Return to KiBiAI Home" → `https://kibiai.itsb3.xyz`
- Fade-in animation

---

### Step 5: Sync Subdomain on Company Onboarding

**File**: `src/app/api/company/route.ts` (existing POST handler — add after company creation)

After a company is created:
1. Derive `slug` from `company_name` (kebab-case normalization, same as existing resolver).
2. Block reserved slugs: `['admin', 'api', 'www', 'kibiai', 'app']`.
3. Insert into `allowed_subdomains`: `{ slug, company_id, is_active: true }`.

On company deactivation/deletion:
- Set `allowed_subdomains.is_active = false` for that `company_id`.

---

### Step 6: Admin Panel — Subdomain Link per Company

**File**: `src/app/admin/page.tsx` (existing — modify CompanyDetails section)

Add a "Workspace URL" display in the company details card:

```
Workspace URL:  https://acme-corp.kibiai.itsb3.xyz
                [📋 Copy]  [↗ Open]
```

- Derive slug from `company_name` using existing normalization.
- Construct: `https://${slug}.${process.env.NEXT_PUBLIC_BASE_DOMAIN}`.
- On `localhost`: show `http://localhost:3000/${slug}` instead.
- Copy-to-clipboard and new-tab buttons.

---

### Step 7: Environment Variables

**Add to `.env.local`** (and Vercel dashboard):

```env
# Root domain (no protocol, no subdomain)
NEXT_PUBLIC_BASE_DOMAIN=kibiai.itsb3.xyz

# Reserved admin subdomain keyword
NEXT_PUBLIC_ADMIN_SUBDOMAIN=admin
```

---

### Step 8: Vercel Domain Configuration (Manual)

> **Developer Action Required** — no code changes:
> 1. In Vercel Project Settings → Domains: add `kibiai.itsb3.xyz` and `*.kibiai.itsb3.xyz`.
> 2. Both should point to the same deployment.
> 3. Wildcard domain requires your DNS provider to have a wildcard CNAME (`*`) pointing to Vercel.

---

## Database Changes Summary

| Table | Change | Migration File |
|---|---|---|
| `allowed_subdomains` | New table | `014_allowed_subdomains.sql` |

---

## File Changes Summary

| File | Action | Description |
|---|---|---|
| `src/middleware.ts` | CREATE | Core subdomain rewriting logic |
| `src/app/api/subdomains/validate/route.ts` | CREATE | Public API for slug validation |
| `src/app/invalid-subdomain/page.tsx` | CREATE | Error page for unknown subdomains |
| `src/app/api/company/route.ts` | MODIFY | Sync `allowed_subdomains` on company create |
| `src/app/admin/page.tsx` | MODIFY | Show subdomain URL per company |
| `ai-workspace/sql/014_allowed_subdomains.sql` | CREATE | DB migration script |
| `.env.local` | MODIFY | Add `NEXT_PUBLIC_BASE_DOMAIN` |
| `ai-workspace/docs/db-architecture.md` | MODIFY | Document new table |
| `ai-workspace/docs/company_logic_implementation.md` | MODIFY | Document subdomain strategy |

---

## Execution Order

```
Step 1 → SQL Migration (developer runs manually)
Step 2 → /api/subdomains/validate route
Step 3 → middleware.ts
Step 4 → /invalid-subdomain page
Step 5 → Sync company creation
Step 6 → Admin UI subdomain link
Step 7 → Env vars
Step 8 → ESLint + build check
```

---

## Risk & Mitigations

| Risk | Mitigation |
|---|---|
| Middleware fetch latency | Module-level in-memory cache (TTL 60s) |
| Dev workflow broken | `localhost` detection skips subdomain logic entirely |
| Slug conflicts | `UNIQUE` constraint on `allowed_subdomains.slug` |
| Company named "admin" | Block reserved keywords at creation time |
| Wildcard subdomain not routing | Ensure Vercel wildcard domain config is correct |

---

## Testing Plan

| Test | Type | Tool |
|---|---|---|
| `admin.kibiai.itsb3.xyz` → `/admin` | E2E | Playwright |
| Valid slug subdomain → company workspace | E2E | Playwright |
| Unknown subdomain → `/invalid-subdomain` | E2E | Playwright |
| `localhost:3000/admin` still works (no regression) | E2E | Playwright |
| `POST /api/company` inserts `allowed_subdomains` | API | Vitest |
| Reserved keywords blocked at slug creation | Unit | Vitest |

---

> ⛔ **AWAITING DEVELOPER APPROVAL BEFORE ANY EXECUTION**
