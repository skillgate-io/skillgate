/* Cancel page — checkout cancelled return */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { trackEvent } from '@/lib/analytics';

export default function CancelPage() {
  useEffect(() => {
    trackEvent('checkout_cancel', 'return_page');
  }, []);

  return (
    <section className="relative flex min-h-[60vh] items-center justify-center bg-[#05070b] py-20" aria-labelledby="cancel-heading">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(76,110,245,0.18),transparent_40%)]" />
      <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-10 text-center backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
          <svg className="h-8 w-8 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 id="cancel-heading" className="mt-6 text-3xl font-bold text-white">
          Checkout Canceled
        </h1>

        <p className="mt-4 text-surface-300">
          Your checkout was canceled and you haven&apos;t been charged.
          You can retry anytime.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/pricing">
            <Button size="lg">View Plans</Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="lg">Back to Home</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
