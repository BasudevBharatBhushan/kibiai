/**
 * Host-based routing helpers.
 *
 * Tenant routing has two modes:
 *  - **Subdomain-based** — used ONLY for the configured base domain and its
 *    subdomains (e.g. `kibiai.itsb3.xyz`, `acme.kibiai.itsb3.xyz`).
 *  - **Path-based** — used for everything else: localhost, LAN IPs, and
 *    preview deployments such as `*.vercel.app`. These behave like local dev
 *    (`/<company_slug>/...`) and use a host-only session cookie.
 *
 * These helpers are pure string logic so they can run in the Edge runtime
 * (middleware), on the server (auth), and in the browser (client components).
 */

/** Strips the port and lowercases a hostname (e.g. `"Foo.com:3000"` → `"foo.com"`). */
function normalizeHost(hostname: string | null | undefined): string {
  return (hostname || "").split(":")[0].toLowerCase().trim();
}

/**
 * True when the host is the configured base domain or one of its subdomains.
 * Only these hosts use subdomain-based tenant routing.
 *
 * Returns `false` when `baseDomain` is empty/unset (nothing can match), which
 * makes every host fall back to path-based routing.
 */
export function usesSubdomainRouting(
  hostname: string | null | undefined,
  baseDomain: string | null | undefined
): boolean {
  const base = normalizeHost(baseDomain);
  if (!base) return false;
  const host = normalizeHost(hostname);
  if (!host) return false;
  return host === base || host.endsWith(`.${base}`);
}

/**
 * True when the host should use path-based tenant routing (like local dev).
 * This is simply the inverse of {@link usesSubdomainRouting} — it covers
 * localhost, LAN IPs, and preview hosts (anything not under the base domain).
 */
export function usesPathRouting(
  hostname: string | null | undefined,
  baseDomain: string | null | undefined
): boolean {
  return !usesSubdomainRouting(hostname, baseDomain);
}
