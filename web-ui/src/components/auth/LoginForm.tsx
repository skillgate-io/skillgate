/* Login form — email + password authentication. */
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { isApiError } from '@/lib/api-client';
import { trackEvent } from '@/lib/analytics';

const REQUIRE_EMAIL_VERIFICATION =
  (process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION || '').toLowerCase() === 'true';

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login({ email, password });
      trackEvent('login_success');
      const redirect = searchParams.get('redirect');
      if (REQUIRE_EMAIL_VERIFICATION && !user.email_verified) {
        router.push('/verify-email');
      } else {
        router.push(redirect || '/dashboard');
      }
    } catch (err) {
      if (isApiError(err)) {
        // Don't reveal whether email exists — generic message
        if (err.status === 401 || err.status === 400) {
          setError('Invalid email or password.');
        } else if (err.status === 403) {
          setError('Please verify your email before logging in.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <h1 className="text-center text-2xl font-bold text-white">
          Welcome back
        </h1>
        <p className="mt-2 text-center text-sm text-surface-400">
          Sign in to continue to your dashboard
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-surface-300">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-white placeholder-surface-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-surface-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-white placeholder-surface-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Your password"
            />
          </div>

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Log In
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-surface-400">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-medium text-brand-400 hover:text-brand-300">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
