'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { USER_QUERY_KEY, useAuth } from '@/components/providers/AuthProvider';
import { confirmEmailVerification, requestEmailVerification } from '@/lib/api-client';

export function VerifyEmailPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const token = searchParams.get('token');
  const emailFromQuery = searchParams.get('email');

  async function refreshUser(): Promise<boolean> {
    await queryClient.invalidateQueries({ queryKey: USER_QUERY_KEY });
    await queryClient.refetchQueries({ queryKey: USER_QUERY_KEY, type: 'active' });
    const refreshed = queryClient.getQueryData(USER_QUERY_KEY) as { email_verified?: boolean } | null;
    return Boolean(refreshed?.email_verified);
  }

  async function handleConfirmToken() {
    if (!token) return;
    setChecking(true);
    setMessage('');
    try {
      await confirmEmailVerification(token);
      setConfirmed(true);
      if (user === null) {
        setMessage('Email verified. Please log in to continue.');
        return;
      }
      const verified = await refreshUser();
      if (verified) {
        router.push('/dashboard');
        return;
      }
      setMessage('Email verified. You can continue to your dashboard.');
    } catch {
      setMessage('Verification link is invalid or expired. Request a new one below.');
    } finally {
      setChecking(false);
    }
  }

  async function handleContinue() {
    setChecking(true);
    setMessage('');
    try {
      if (await refreshUser()) {
        router.push('/dashboard');
        return;
      }
      setMessage('Email still unverified. Check inbox and click your verification link first.');
    } finally {
      setChecking(false);
    }
  }

  async function handleResend() {
    const targetEmail = user?.email ?? emailFromQuery;
    if (!targetEmail) {
      setMessage('Missing email. Please sign up again.');
      return;
    }
    setSending(true);
    setMessage('');
    try {
      await requestEmailVerification(targetEmail);
      setMessage('Verification email sent. Check your inbox.');
    } catch {
      setMessage('Unable to send verification email right now.');
    } finally {
      setSending(false);
    }
  }

  async function handleSignOut() {
    await logout();
    router.push('/login');
  }

  return (
    <div className="w-full rounded-2xl border border-amber-400/30 bg-amber-500/10 p-8">
      <h1 className="text-2xl font-bold text-white">Verify your email</h1>
      <p className="mt-3 text-sm text-surface-200">
        You are signed in{user?.email ? ` as ${user.email}` : ''}, but dashboard access is blocked
        until email verification is complete.
      </p>
      <p className="mt-2 text-sm text-surface-300">
        Open the verification email, click the link, then continue.
      </p>

      {message && (
        <p className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
          {message}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {token && !confirmed ? (
          <Button onClick={handleConfirmToken} loading={checking}>
            Confirm verification
          </Button>
        ) : (
          <Button onClick={handleContinue} loading={checking}>
            I verified, continue
          </Button>
        )}
        <Button variant="ghost" className="text-surface-200 hover:bg-white/10 hover:text-white" onClick={handleResend} loading={sending}>
          Resend email
        </Button>
        {user ? (
          <Button variant="ghost" className="text-surface-200 hover:bg-white/10 hover:text-white" onClick={handleSignOut}>
            Sign out
          </Button>
        ) : (
          <Button variant="ghost" className="text-surface-200 hover:bg-white/10 hover:text-white" onClick={() => router.push('/login')}>
            Go to login
          </Button>
        )}
      </div>
    </div>
  );
}
