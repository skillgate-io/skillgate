/* Token storage utilities — localStorage with graceful fallback. */

const ACCESS_TOKEN_KEY = 'sg_access_token';
const REFRESH_TOKEN_KEY = 'sg_refresh_token';

function safeGet(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(key, value);
  } catch { /* quota exceeded or private browsing */ }
}

function safeRemove(key: string): void {
  try {
    if (typeof window !== 'undefined') localStorage.removeItem(key);
  } catch { /* noop */ }
}

export function getAccessToken(): string | null {
  return safeGet(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return safeGet(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  safeSet(ACCESS_TOKEN_KEY, accessToken);
  safeSet(REFRESH_TOKEN_KEY, refreshToken);
  // Mirror auth state as cookie for Next.js middleware (edge runtime can't read localStorage)
  try {
    if (typeof document !== 'undefined') {
      document.cookie = 'sg_authenticated=1; path=/; max-age=2592000; SameSite=Lax';
      // Conservative default until /me resolves.
      document.cookie = 'sg_email_verified=0; path=/; max-age=2592000; SameSite=Lax';
    }
  } catch { /* noop */ }
}

export function setEmailVerified(verified: boolean): void {
  try {
    if (typeof document !== 'undefined') {
      document.cookie = `sg_email_verified=${verified ? '1' : '0'}; path=/; max-age=2592000; SameSite=Lax`;
    }
  } catch { /* noop */ }
}

export function clearTokens(): void {
  safeRemove(ACCESS_TOKEN_KEY);
  safeRemove(REFRESH_TOKEN_KEY);
  try {
    if (typeof document !== 'undefined') {
      document.cookie = 'sg_authenticated=; path=/; max-age=0';
      document.cookie = 'sg_email_verified=; path=/; max-age=0';
    }
  } catch { /* noop */ }
}
