/* 16.18: Header with responsive mobile nav, keyboard navigation, focus management
 * 16.19: Auth-aware header — shows user state when logged in
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { trackEvent } from '@/lib/analytics';
import { useAuth } from '@/components/providers/AuthProvider';

const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/roadmap', label: 'Roadmap' },
  { href: '/docs', label: 'Docs' },
] as const;

export function Header() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMenuItemRef = useRef<HTMLAnchorElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 16.18: Close mobile menu on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (userMenuOpen) setUserMenuOpen(false);
      if (mobileMenuOpen) {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
  }, [mobileMenuOpen, userMenuOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 16.18: Focus first menu item when menu opens
  useEffect(() => {
    if (mobileMenuOpen) {
      firstMenuItemRef.current?.focus();
    }
  }, [mobileMenuOpen]);

  // 16.18: Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  async function handleLogout() {
    await logout();
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    router.push('/');
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#05070c]/80 backdrop-blur-xl" role="banner">
      <nav
        className="mx-auto flex max-w-content items-center justify-between px-4 py-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="group relative flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-2xl font-black tracking-[0.02em] text-white transition hover:scale-[1.01] sm:gap-3 sm:text-3xl"
          aria-label="SkillGate home"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1 rounded-2xl bg-[radial-gradient(circle_at_30%_35%,rgba(59,130,246,0.22),rgba(59,130,246,0.0)_55%),radial-gradient(circle_at_78%_70%,rgba(16,185,129,0.16),rgba(16,185,129,0.0)_55%)] opacity-80 blur-sm transition group-hover:opacity-100"
          />
          <svg
            viewBox="0 0 64 72"
            fill="none"
            className="h-8 w-7 flex-shrink-0 drop-shadow-[0_0_14px_rgba(59,130,246,0.45)] sm:h-9 sm:w-8"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="hdr-stroke" x1="32" y1="2" x2="32" y2="70" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
              <linearGradient id="hdr-inner" x1="32" y1="9" x2="32" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.15" />
              </linearGradient>
              <linearGradient id="hdr-lock" x1="32" y1="22" x2="32" y2="48" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="100%" stopColor="#6ee7b7" />
              </linearGradient>
            </defs>
            <path
              d="M32 3L59 14V36C59 52 32 69 32 69C32 69 5 52 5 36V14L32 3Z"
              stroke="url(#hdr-stroke)"
              strokeWidth="1.5"
              fill="rgba(9,12,19,0.88)"
            />
            <path
              d="M32 9L53 18.5V35C53 48 32 63 32 63C32 63 11 48 11 35V18.5L32 9Z"
              stroke="url(#hdr-inner)"
              strokeWidth="0.75"
              fill="url(#hdr-inner)"
            />
            <path
              d="M26.5 33.5V28C26.5 23 37.5 23 37.5 28V33.5"
              stroke="url(#hdr-lock)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            <rect x="22.5" y="33" width="19" height="13" rx="2.5" fill="url(#hdr-lock)" opacity="0.85" />
            <circle cx="32" cy="38.5" r="2.2" fill="rgba(9,12,19,0.8)" />
            <rect x="30.8" y="38.5" width="2.4" height="3.5" rx="1.2" fill="rgba(9,12,19,0.8)" />
            <text
              x="32"
              y="57"
              textAnchor="middle"
              fontFamily="'JetBrains Mono','Fira Code',monospace"
              fontSize="6.5"
              fontWeight="700"
              fill="#94a3b8"
              letterSpacing="1.5"
            >
              SG
            </text>
          </svg>
          <span className="relative z-10 bg-[linear-gradient(92deg,#ffffff_5%,#cfe4ff_40%,#b7f5d8_92%)] bg-clip-text text-transparent">
            SkillGate
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.02] px-2.5 py-1.5 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-surface-400 transition-colors hover:bg-white/5 hover:text-surface-200"
            >
              {link.label}
            </Link>
          ))}

          <a
            href="https://github.com/skillgate/skillgate"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-surface-400 transition-colors hover:bg-white/5 hover:text-surface-200"
            aria-label="SkillGate on GitHub (opens in new tab)"
            onClick={() => trackEvent('github_click')}
          >
            GitHub
          </a>

          {!loading && isAuthenticated && user ? (
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-surface-200 transition-colors hover:bg-white/10 hover:text-white"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {(user.full_name?.[0] || user.email[0]).toUpperCase()}
                </span>
                <span className="max-w-[120px] truncate">{user.full_name || user.email}</span>
                <svg className="h-4 w-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-[#0c1119] py-1 shadow-xl">
                  <div className="border-b border-white/10 px-4 py-3">
                    <p className="truncate text-sm font-medium text-white">{user.full_name || 'User'}</p>
                    <p className="truncate text-xs text-surface-400">{user.email}</p>
                  </div>
                  <Link
                    href="/dashboard"
                    className="block px-4 py-2.5 text-sm text-surface-300 hover:bg-white/5 hover:text-white"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full px-4 py-2.5 text-left text-sm text-surface-300 hover:bg-white/5 hover:text-white"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : !loading ? (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-surface-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                Log In
              </Link>
              <Button
                size="sm"
                onClick={() => {
                  trackEvent('signup_cta_click', 'header');
                  router.push('/signup');
                }}
              >
                Start Free
              </Button>
            </>
          ) : null}
        </div>

        {/* 16.18: Mobile menu button with proper ARIA */}
        <button
          ref={menuButtonRef}
          type="button"
          className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.03] p-2 text-surface-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 md:hidden"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </nav>

      {/* 16.18: Mobile menu with focus trap and keyboard nav */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          'fixed inset-x-0 top-[65px] z-50 h-[calc(100vh-65px)] bg-[#0c1119] transition-transform duration-200 md:hidden',
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex flex-col gap-1 p-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              ref={link.href === '/features' ? firstMenuItemRef : undefined}
              href={link.href}
              className="rounded-lg px-4 py-3 text-lg font-medium text-surface-100 hover:bg-white/10"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}

          <a
            href="https://github.com/skillgate/skillgate"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-4 py-3 text-lg font-medium text-surface-100 hover:bg-white/10"
            onClick={() => {
              trackEvent('github_click');
              setMobileMenuOpen(false);
            }}
          >
            GitHub ↗
          </a>

          <div className="mt-4 space-y-3 px-4">
            {!loading && isAuthenticated && user ? (
              <>
                <div className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-4 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                    {(user.full_name?.[0] || user.email[0]).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{user.full_name || 'User'}</p>
                    <p className="truncate text-xs text-surface-400">{user.email}</p>
                  </div>
                </div>
                <Link
                  href="/dashboard"
                  className="block w-full rounded-lg bg-brand-600 px-4 py-3 text-center text-base font-semibold text-white hover:bg-brand-700"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-white/20 text-surface-200 hover:bg-white/10"
                  onClick={handleLogout}
                >
                  Log out
                </Button>
              </>
            ) : !loading ? (
              <>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    trackEvent('signup_cta_click', 'mobile_menu');
                    setMobileMenuOpen(false);
                    router.push('/signup');
                  }}
                >
                  Start Free
                </Button>
                <Link
                  href="/login"
                  className="block rounded-lg py-3 text-center text-base font-medium text-surface-300 hover:text-white"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Log In
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
