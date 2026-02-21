/* Route protection middleware.
 *
 * Checks sg_authenticated cookie (non-secret mirror of localStorage auth state)
 * to redirect unauthenticated users away from /dashboard.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PATHS = ['/dashboard'];
const AUTH_PATHS = ['/login', '/signup'];
const VERIFY_PATH = '/verify-email';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = request.cookies.get('sg_authenticated')?.value === '1';
  const isEmailVerified = request.cookies.get('sg_email_verified')?.value === '1';

  // Protect dashboard routes
  if (PROTECTED_PATHS.some((p) => pathname.startsWith(p))) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!isEmailVerified) {
      return NextResponse.redirect(new URL(VERIFY_PATH, request.url));
    }
  }

  // Redirect authenticated users away from login/signup
  if (AUTH_PATHS.some((p) => pathname === p)) {
    if (isAuthenticated) {
      // Allow login for authenticated-but-unverified users so they can switch accounts.
      if (!isEmailVerified && pathname !== '/login') {
        return NextResponse.redirect(new URL(VERIFY_PATH, request.url));
      }
      if (isEmailVerified) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  if (pathname === VERIFY_PATH && isAuthenticated && isEmailVerified) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup', '/verify-email'],
};
