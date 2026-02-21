/* 16.14: Global error page — App Router error.tsx */
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to observability (never surface raw error to user)
    console.error('[App Error]', error.message, error.digest);
  }, [error]);

  return (
    <section
      className="relative flex min-h-[60vh] items-center justify-center bg-[#05070b] py-20"
      role="alert"
      aria-labelledby="error-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(239,68,68,0.12),transparent_40%)]" />
      <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-10 text-center backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
          <svg className="h-8 w-8 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>

        <h1 id="error-heading" className="mt-6 text-3xl font-bold text-white">
          Something Went Wrong
        </h1>

        <p className="mt-4 text-surface-300">
          We encountered an unexpected error. Please try again or contact
          support if the problem persists.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" onClick={reset}>
            Try Again
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => (window.location.href = '/')}
          >
            Go Home
          </Button>
        </div>
      </div>
    </section>
  );
}
