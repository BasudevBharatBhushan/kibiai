# L-014: Subdomain-Based Routing — Execution Log

**Ticket**: T-014-subdomain-routing.md  
**Plan**: P-014-subdomain-routing.md  
**Scope**: fullstack  
**Started**: 2026-04-28  
**Status**: COMPLETED ✅

---

## Step 1 — SQL Migration ✅
**File Created**: `ai-workspace/sql/014_allowed_subdomains.sql`

- Created `allowed_subdomains` table with `slug`, `company_id`, `is_active`, timestamps.
- Added `UNIQUE` constraint on `slug` to prevent collisions.
- Enabled RLS with a public `SELECT` policy for active rows (required by unauthenticated middleware).
- Added `idx_allowed_subdomains_slug` partial index (only active rows) for fast lookups.
- Added auto-update trigger for `updated_on`.
- Commented-out backfill script included for existing companies.
- Updated `ai-workspace/docs/db-architecture.md` with table definition.

> ⚠️ **Developer Action Required**: Execute `014_allowed_subdomains.sql` in Supabase SQL Editor before deploying.

---

## Step 2 — Subdomain Validation API ✅
**File Created**: `src/app/api/subdomains/validate/route.ts`

- Public `GET /api/subdomains/validate?slug=<slug>` endpoint.
- Uses `createAdminClient()` to bypass RLS.
- In-process `Map`-based cache with 60s TTL to minimize DB round-trips.
- Reserved slugs short-circuit to `{ valid: true, reserved: true }` without DB hit.
- Returns `{ valid: boolean }`.

---

## Step 3 — Next.js Middleware ✅
**File Created**: `middleware.ts` (project root)

- Reads `Host` header on every non-asset request.
- **Localhost detection**: Skips all subdomain logic for `localhost`, `127.0.0.1`, `192.168.*`.
- **Reserved route**: `admin` subdomain rewrites to `/admin{pathname}`.
- **Reserved blocked**: `api`, `www`, `kibiai`, etc. rewrite to `/invalid-subdomain`.
- **Dynamic slugs**: Calls `/api/subdomains/validate` with module-level cache (60s TTL).
- **Unknown**: Rewrites to `/invalid-subdomain`.
- **Matcher**: Excludes `_next/static`, `_next/image`, `favicon.ico`, `api/*`, and static file extensions.
- Uses `NextResponse.rewrite()` — browser URL remains the subdomain (no redirect).

---

## Step 4 — Invalid Subdomain Error Page ✅
**File Created**: `src/app/invalid-subdomain/page.tsx`

- Branded KiBiAI error page with glassmorphism design.
- SEO metadata: `noindex, nofollow`.
- Animated background orbs, fade-in card animation.
- Dual CTAs: "Go to KiBiAI Home" and "Contact Support".
- Self-contained — no provider dependencies.
- Build result: renders as `○ (Static)` — prerendered at build time.

---

## Step 5 — Sync allowed_subdomains on Company Create/Update ✅
**File Modified**: `src/app/api/company/route.ts`

- Added `toSlug()` utility function (exact match of `CompanyDetails.slugify`).
- Added `RESERVED_SLUGS` Set to block `admin`, `api`, `www`, etc. at creation time.
- **POST**: Validates slug is not reserved, checks slug uniqueness in `allowed_subdomains`, inserts row after company creation.
- **PUT**: Syncs `allowed_subdomains.is_active` when `company.status` changes.
- Subdomain insertion is non-fatal (logs error but doesn't fail company creation).
- Response now includes `companySlug` field.

---

## Step 6 — Admin Panel Workspace URL ✅
**File Modified**: `src/components/CompanyDetails.tsx`

- Updated `slugify` to match server-side `toSlug()` exactly.
- Added production vs localhost detection via `window.location.hostname`.
- **Production**: Shows `https://<slug>.kibiai.itsb3.xyz/login` as workspace URL.
- **Localhost**: Shows `http://localhost:3000/<slug>/login` (unchanged behavior).
- Added visual "Production" badge in the Workspace URL card.
- Added highlighted subdomain display row showing `slug.domain` breakdown.
- Added `id` attributes to buttons for E2E testability.

---

## Step 7 — Environment Variables ✅
**File Modified**: `.env.local`

```
NEXT_PUBLIC_BASE_DOMAIN=kibiai.itsb3.xyz
NEXT_PUBLIC_ADMIN_SUBDOMAIN=admin
```

> ⚠️ **Developer Action Required**: Also add these to Vercel Project → Settings → Environment Variables.

---

## Step 8 — Build Verification ✅

```
Exit code: 0

Route (app)
├ ○ /invalid-subdomain          ← New static error page ✓
├ ƒ /api/subdomains/validate    ← New validation API ✓
ƒ Proxy (Middleware)            ← Middleware registered ✓
```

TypeScript errors: Only in pre-existing `tests/api/filemaker_setup.test.ts` (pre-existing, not introduced by this change).

---

## Remaining Developer Actions

1. **Run SQL migration** in Supabase SQL Editor:  
   `ai-workspace/sql/014_allowed_subdomains.sql`

2. **Add env vars to Vercel**:  
   `NEXT_PUBLIC_BASE_DOMAIN=kibiai.itsb3.xyz`  
   `NEXT_PUBLIC_ADMIN_SUBDOMAIN=admin`

3. **Configure Vercel Domains**:  
   - Add `kibiai.itsb3.xyz` (apex)
   - Add `*.kibiai.itsb3.xyz` (wildcard)
   - Both should point to the same deployment

4. **Backfill existing companies** (optional):  
   After verifying `toSlug()` output matches DB data, un-comment and run the backfill section in the SQL migration.
