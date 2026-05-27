import { NextResponse } from "next/server";
import { deleteSession } from "@/utils/auth";

export async function POST(req: Request) {
  await deleteSession();

  const response = NextResponse.json({ success: true });
  const domain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  const host = req.headers.get('host') || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

  // We must send TWO separate Set-Cookie headers to cover both cookie variants:
  //  1. Cookies set WITHOUT a domain attribute (host-specific, older sessions).
  //  2. Cookies set WITH domain=.kibiai.itsb3.xyz (cross-subdomain sessions).
  //
  // response.cookies.set() called twice with the same name only keeps the LAST
  // one (they overwrite each other). Using headers.append() sends both headers.

  const base = `kibiai_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;

  // Clear 1: no domain (removes host-specific cookie e.g. equiparts.kibiai.itsb3.xyz)
  response.headers.append('Set-Cookie', base);

  // Clear 2: with apex domain (removes cross-subdomain cookie .kibiai.itsb3.xyz)
  if (domain && !domain.includes('localhost') && !isLocalhost) {
    response.headers.append('Set-Cookie', `${base}; Domain=.${domain}`);
  }

  return response;
}
