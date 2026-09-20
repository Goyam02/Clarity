import { NextRequest, NextResponse } from 'next/server';
import { isAuthEnforced } from './src/lib/auth/authConfig';

const PROTECTED_PREFIXES = ['/dashboard', '/onboarding', '/graph'];
const AUTH_COOKIE = 'clarity_session';

export function middleware(req: NextRequest) {
  // If route protection is not enforced (default), allow guest access without redirect
  if (!isAuthEnforced()) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isProtected) {
    const sessionToken = req.cookies.get(AUTH_COOKIE)?.value;
    if (!sessionToken) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding/:path*', '/graph/:path*'],
};
