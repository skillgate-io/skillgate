/* Signup form — email, password, optional name. */
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { isApiError } from '@/lib/api-client';
import { trackEvent } from '@/lib/analytics';

export function SignupForm() {
  const { signup } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteRef = searchParams.get('ref');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signup({
        email,
        password,
        ...(fullName.trim() ? { full_name: fullName.trim() } : {}),
      });
      trackEvent('signup_success');
      if (inviteRef) {
        trackEvent('invite_accepted', 'signup_success', { source: 'dashboard_invite_link' });
      }
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
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
          Create your account
        </h1>
        <p className="mt-2 text-center text-sm text-surface-400">
          Start with local scans, then add policy gates and signed evidence
        </p>
        {inviteRef && (
          <p className="mt-3 rounded-md border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-center text-xs text-brand-300">
            You were invited by a teammate. Finish signup to join their workspace.
          </p>
        )}

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
            <label htmlFor="full-name" className="block text-sm font-medium text-surface-300">
              Full name <span className="text-surface-500">(optional)</span>
            </label>
            <input
              id="full-name"
              type="text"
              autoComplete="name"
              maxLength={120}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-white placeholder-surface-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Jane Doe"
            />
          </div>

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
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-white placeholder-surface-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Min 12 characters"
            />
            <p className="mt-1 text-xs text-surface-500">Must be at least 12 characters</p>
          </div>

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Create Account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-surface-400">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand-400 hover:text-brand-300">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
