import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/utils/auth";
import { usesSubdomainRouting } from "@/lib/utils/hostRouting";

export async function POST(request: NextRequest) {
  await deleteSession();

  const response = NextResponse.json({ success: true });
  const domain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  const host = request.headers.get("host") || "";

  // Forcefully clear the cookie on the response object to cover all bases.
  // Always clear the host-only cookie.
  response.cookies.set('kibiai_session', '', { path: '/', maxAge: 0 });

  // Clear the cross-subdomain cookie only on the base domain, where it could
  // have been set. On preview/localhost hosts it was never scoped that way.
  if (usesSubdomainRouting(host, domain)) {
    response.cookies.set('kibiai_session', '', { path: '/', maxAge: 0, domain: `.${domain}` });
  }

  return response;
}
