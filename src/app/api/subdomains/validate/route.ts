import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";

// Reserved subdomains that are always blocked from company registration
// and always resolve to specific platform routes.
const RESERVED_SLUGS = new Set([
  "admin",
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

// Simple in-process cache to reduce DB hits.
// TTL: 60 seconds. Resets on cold start (serverless function restart).
const slugCache = new Map<string, { valid: boolean; cachedAt: number }>();
const CACHE_TTL_MS = 60_000;

// ── GET /api/subdomains/validate?slug=<slug> ──────────────────────────────────
// Public endpoint — no authentication required.
// Called by Next.js middleware (server-side) to determine if a subdomain is valid.
//
// Response:
//   200: { valid: true }   → subdomain maps to an active company workspace
//   200: { valid: false }  → unknown or inactive subdomain → show error page
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug")?.toLowerCase().trim();

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "slug query param is required" },
        { status: 400 }
      );
    }

    // Reserved slugs are ALWAYS valid platform routes — never hit the DB.
    if (RESERVED_SLUGS.has(slug)) {
      return NextResponse.json({ valid: true, reserved: true });
    }

    // Check in-process cache first
    const cached = slugCache.get(slug);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({ valid: cached.valid, source: "cache" });
    }

    // Query the database for the slug
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("allowed_subdomains")
      .select("slug, is_active")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/subdomains/validate] DB error:", error);
      // On DB error, fail open (don't block valid users due to infra issues)
      return NextResponse.json({ valid: false, error: "Service temporarily unavailable" }, { status: 503 });
    }

    const valid = data !== null;

    // Populate cache
    slugCache.set(slug, { valid, cachedAt: Date.now() });

    return NextResponse.json({ valid });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /api/subdomains/validate]", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
