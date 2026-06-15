import { NextResponse } from "next/server";
import { deleteSession } from "@/utils/auth";

export async function POST() {
  await deleteSession();
  
  const response = NextResponse.json({ success: true });
  const domain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  
  // Forcefully clear the cookie on the response object to cover all bases
  // Clear without domain
  response.cookies.set('kibiai_session', '', { path: '/', maxAge: 0 });
  
  // Clear with domain if applicable
  if (domain && !domain.includes('localhost')) {
    response.cookies.set('kibiai_session', '', { path: '/', maxAge: 0, domain: `.${domain}` });
  }

  return response;
}
