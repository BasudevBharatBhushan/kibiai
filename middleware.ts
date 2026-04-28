import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The root domain without protocol or subdomain. Set via env var in production. */
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "kibiai.itsb3.xyz";

/**
 * Reserved subdomains that map to known platform routes.
 * These are NEVER looked up in the DB — hardcoded for zero-latency resolution.
 */
const RESERVED_SUBDOMAIN_ROUTES: Record<string, string> = {
  admin: "/admin",
};

/**
 * Subdomains that are reserved but do NOT have a route rewrite.
 * They should resolve to the invalid-subdomain page to prevent impersonation.
 */
const RESERVED_BLOCKED_SLUGS = new Set([
  "api",
  "www",
  "kibiai",
  "app",
  "mail",
  "ftp",
  "support",
  "help",
  "static",
  "assets",
]);

// ---------------------------------------------------------------------------
// In-process slug validation cache
// Resets on cold start (acceptable for serverless).
// ---------------------------------------------------------------------------
interface CacheEntry {
  valid: boolean;
  cachedAt: number;
}
const slugCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Validates a company slug against the allowed_subdomains table.
 * Uses an internal API call so the middleware can run in the Edge runtime
 * without a direct Supabase client (which requires Node.js APIs).
 */
async function isValidCompanySlug(slug: string, requestUrl: URL): Promise<boolean> {
  // Check in-process cache first
  const cached = slugCache.get(slug);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.valid;
  }

  try {
    // Call our internal validation API
    const validateUrl = new URL(
      `/api/subdomains/validate?slug=${encodeURIComponent(slug)}`,
      requestUrl.origin
    );

    const response = await fetch(validateUrl.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      // Next.js fetch cache: revalidate every 60s
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      // On API failure, fail closed for unknown slugs (security default)
      console.warn(`[middleware] Subdomain validation API returned ${response.status} for slug: ${slug}`);
      slugCache.set(slug, { valid: false, cachedAt: Date.now() });
      return false;
    }

    const json = await response.json();
    const valid = json?.valid === true;

    slugCache.set(slug, { valid, cachedAt: Date.now() });
    return valid;
  } catch (err) {
    console.error("[middleware] Failed to validate subdomain slug:", slug, err);
    // On network error, fail closed
    return false;
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const pathname = request.nextUrl.pathname;

  // ── 1. Skip in dev/localhost environment ──────────────────────────────────
  if (
    hostname.includes("localhost") ||
    hostname.includes("127.0.0.1") ||
    hostname.startsWith("192.168.")
  ) {
    return NextResponse.next();
  }

  // ── 2. Extract subdomain ──────────────────────────────────────────────────
  // e.g. "acme-corp.kibiai.itsb3.xyz" → subdomain = "acme-corp"
  //      "kibiai.itsb3.xyz"           → subdomain = null (apex domain)
  let subdomain: string | null = null;

  if (hostname.endsWith(`.${BASE_DOMAIN}`)) {
    subdomain = hostname.slice(0, -(`.${BASE_DOMAIN}`.length)).toLowerCase().trim();
  }

  // No subdomain → apex domain, let the request proceed normally
  if (!subdomain) {
    return NextResponse.next();
  }

  // ── 3. Handle reserved platform subdomains (e.g. "admin") ─────────────────
  if (RESERVED_SUBDOMAIN_ROUTES[subdomain]) {
    const rewritePath = RESERVED_SUBDOMAIN_ROUTES[subdomain];
    const rewriteUrl = new URL(`${rewritePath}${pathname}`, request.url);
    rewriteUrl.search = request.nextUrl.search;
    return NextResponse.rewrite(rewriteUrl);
  }

  // ── 4. Block reserved-but-unrouted slugs ──────────────────────────────────
  if (RESERVED_BLOCKED_SLUGS.has(subdomain)) {
    const errorUrl = new URL("/invalid-subdomain", request.url);
    return NextResponse.rewrite(errorUrl);
  }

  // ── 5. Validate dynamic company slug against DB registry ──────────────────
  const requestUrl = new URL(request.url);
  const valid = await isValidCompanySlug(subdomain, requestUrl);

  if (valid) {
    // Rewrite: acme-corp.kibiai.itsb3.xyz/templates → /acme-corp/templates
    const rewriteUrl = new URL(`/${subdomain}${pathname}`, request.url);
    rewriteUrl.search = request.nextUrl.search;
    return NextResponse.rewrite(rewriteUrl);
  }

  // ── 6. Unknown subdomain → error page ─────────────────────────────────────
  const errorUrl = new URL("/invalid-subdomain", request.url);
  return NextResponse.rewrite(errorUrl);
}

// ---------------------------------------------------------------------------
// Matcher: Run middleware on all routes EXCEPT static assets and raw API calls.
// The /api/subdomains/validate exclusion prevents infinite loops.
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     * - api routes (to avoid recursive middleware calls)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)",
  ],
};
