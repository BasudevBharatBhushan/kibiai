import * as bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';

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

    cookieStore.set(COOKIE_NAME, jwt, {
      httpOnly: true,
      secure: isProd && !isLocalhost,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      ...(isProd && domain && !domain.includes('localhost') && !isLocalhost ? { domain: `.${domain}` } : {})
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
  const isProd = process.env.NODE_ENV === 'production';
  const domain = process.env.NEXT_PUBLIC_BASE_DOMAIN;

  // We set maxAge: 0 to expire the cookie immediately.
  // CRITICAL: We must specify the domain if it was set with one, 
  // otherwise the domain-level cookie will persist.
  cookieStore.set(COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    ...(isProd && domain && !domain.includes('localhost') ? { domain: `.${domain}` } : {})
  });
}
