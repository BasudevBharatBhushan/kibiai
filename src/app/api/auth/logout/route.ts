import { deleteSession } from "@/utils/auth";

export async function POST(req: Request) {
  await deleteSession();

  const domain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  const host = req.headers.get('host') || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

  // Build the two Set-Cookie headers we need to clear ALL cookie variants:
  //   1. No-domain: clears cookies set host-specifically (old sessions before domain fix)
  //   2. With-domain: clears cookies set with Domain=.kibiai.itsb3.xyz (new sessions)
  //
  // Using raw Response with a Headers tuple array is the ONLY reliable way to
  // send two Set-Cookie headers in Next.js — NextResponse and headers.append
  // both deduplicate Set-Cookie by cookie name, dropping one of them.
  const base = `kibiai_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;

  const headerTuples: [string, string][] = [
    ['Content-Type', 'application/json'],
    ['Set-Cookie', base],  // clears host-specific (no domain) cookie
  ];

  if (domain && !domain.includes('localhost') && !isLocalhost) {
    headerTuples.push(['Set-Cookie', `${base}; Domain=.${domain}`]); // clears domain-scoped cookie
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: new Headers(headerTuples),
  });
}

