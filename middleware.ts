import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
const COOKIE_NAME = 'kibiai_session';

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

  // ── 0. Session Check ──────────────────────────────────────────────────────
  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;
  let user: any = null;
  if (sessionCookie) {
    try {
      const { payload } = await jwtVerify(sessionCookie, JWT_SECRET);
      user = payload;
    } catch (e) {
      // Invalid session, cookie will be ignored
    }
  }

  // Define public routes that don't need auth
  const isPublicRoute = 
    pathname.startsWith('/login') || 
    pathname.startsWith('/api/auth') ||
    pathname === '/invalid-subdomain';

  // ── 1. Skip subdomain logic in dev/localhost environment ──────────────────
  if (
    hostname.includes("localhost") ||
    hostname.includes("127.0.0.1") ||
    hostname.startsWith("192.168.")
  ) {
    // Still perform auth checks on localhost
    if (!user && !isPublicRoute) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Platform admin redirect on localhost
    if (user?.accountType === 'platform_admin' && !pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    return NextResponse.next();
  }

  // ── 2. Extract subdomain ──────────────────────────────────────────────────
  // e.g. "acme-corp.kibiai.itsb3.xyz" → subdomain = "acme-corp"
  //      "kibiai.itsb3.xyz"           → subdomain = null (apex domain)
  let subdomain: string | null = null;

  if (hostname.endsWith(`.${BASE_DOMAIN}`)) {
    subdomain = hostname.slice(0, -(`.${BASE_DOMAIN}`.length)).toLowerCase().trim();
  }

  // No subdomain → apex domain
  if (!subdomain) {
    // Auth check for apex domain
    if (!user && !isPublicRoute) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Platform admin redirect on apex
    if (user?.accountType === 'platform_admin') {
      const adminUrl = new URL(pathname, `https://admin.${BASE_DOMAIN}`);
      adminUrl.search = request.nextUrl.search;
      return NextResponse.redirect(adminUrl);
    }

    return NextResponse.next();
  }

  // ── 2.5 Role-Based Redirection ──────────────────────────────────────────
  
  // If platform admin is on a company subdomain, redirect to admin subdomain
  if (user?.accountType === 'platform_admin' && subdomain !== 'admin') {
    const adminUrl = new URL(pathname, `https://admin.${BASE_DOMAIN}`);
    adminUrl.search = request.nextUrl.search;
    return NextResponse.redirect(adminUrl);
  }

  // If company user is on the admin subdomain, redirect them to their company subdomain
  if (user?.accountType === 'company_user' && subdomain === 'admin' && user.companyId) {
    // We need to fetch the company slug for this companyId? 
    // Or assume they should just go back to a safe place.
    // For now, let's just let them proceed and they will likely get 403 from the page logic,
    // OR we could redirect them to their company subdomain if we knew the slug.
    // Since we don't know the slug here without a DB lookup (which we want to avoid),
    // we'll let it pass for now.
  }

  // Auth Guard: If not logged in and not public route, redirect to login
  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // ── 3. Handle reserved platform subdomains (e.g. "admin") ─────────────────
  if (RESERVED_SUBDOMAIN_ROUTES[subdomain]) {
    const rewritePath = RESERVED_SUBDOMAIN_ROUTES[subdomain];
    // Avoid doubling (e.g. admin.domain.com/admin -> /admin/admin)
    const normalizedPath = pathname.startsWith(rewritePath) ? pathname : `${rewritePath}${pathname}`;
    const rewriteUrl = new URL(normalizedPath, request.url);
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
    // Avoid doubling: acme-corp.kibiai.itsb3.xyz/acme-corp/templates → /acme-corp/templates
    const normalizedPath = pathname.startsWith(`/${subdomain}`) ? pathname : `/${subdomain}${pathname}`;
    const rewriteUrl = new URL(normalizedPath, request.url);
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
