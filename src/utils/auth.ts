import * as bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { usesSubdomainRouting } from '@/lib/utils/hostRouting';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
const COOKIE_NAME = 'kibiai_session';

export interface UserPayload {
  accountId: string;
  email: string;
  accountType: 'platform_admin' | 'company_user';
  companyId?: string;
  companySlug?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: UserPayload) {
  const jwt = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);

  const isProd = process.env.NODE_ENV === 'production';
  const domain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  
  // Use a try-catch for cookies() as it can throw in some contexts
  try {
    const cookieStore = await cookies();
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    // The `.${domain}` (cross-subdomain) cookie is only valid — and only
    // accepted by the browser — when the request host is actually under that
    // domain. On preview/localhost hosts we MUST fall back to a host-only
    // cookie, otherwise the browser rejects the Set-Cookie and login never
    // sticks.
    const scopeToBaseDomain = usesSubdomainRouting(host, domain);

    cookieStore.set(COOKIE_NAME, jwt, {
      httpOnly: true,
      secure: isProd && !isLocalhost,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      ...(scopeToBaseDomain ? { domain: `.${domain}` } : {})
    });
  } catch (e) {
    console.error("[auth] Failed to set cookie in createSession:", e);
  }

  return jwt;
}

export async function getSession(): Promise<UserPayload | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME)?.value;

  if (!session) return null;

  try {
    const { payload } = await jwtVerify(session, JWT_SECRET);
    return payload as unknown as UserPayload;
  } catch (error) {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const domain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  const headersList = await headers();
  const host = headersList.get('host') || '';

  // Always clear the host-only cookie.
  cookieStore.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });

  // Also clear the cross-subdomain cookie, but ONLY on the base domain — that's
  // the only place it could have been set. On preview/localhost it never was.
  if (usesSubdomainRouting(host, domain)) {
    cookieStore.set(COOKIE_NAME, '', { path: '/', maxAge: 0, domain: `.${domain}` });
  }
}
