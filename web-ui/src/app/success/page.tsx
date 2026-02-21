/* Success page — post-checkout return.
 *
 * Contract (7.3): This page is non-authoritative.
 * Webhook is the source-of-truth for provisioning.
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { trackEvent } from '@/lib/analytics';

export default function SuccessPage() {
  useEffect(() => {
    trackEvent('checkout_success', 'return_page');
  }, []);

  return (
    <section className="relative flex min-h-[60vh] items-center justify-center bg-[#05070b] py-20" aria-labelledby="success-heading">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(16,185,129,0.18),transparent_40%)]" />
      <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-10 text-center backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
          <svg className="h-8 w-8 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 id="success-heading" className="mt-6 text-3xl font-bold text-white">
          Setup in Progress
        </h1>

        <p className="mt-4 text-surface-300">
          Your subscription is activating now. You&apos;ll receive a confirmation
          email with next steps shortly.
        </p>

        <p className="mt-2 text-sm text-surface-400">
          Provisioning typically completes within 60 seconds.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/docs">
            <Button size="lg">Open Setup Docs</Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="lg">Back to Home</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
