/* 16.14: Global not-found page with actionable recovery */

import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <section className="relative flex min-h-[60vh] items-center justify-center bg-[#05070b] py-20" aria-labelledby="notfound-heading">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(76,110,245,0.2),transparent_40%)]" />
      <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-10 text-center backdrop-blur">
        <p className="text-6xl font-bold text-emerald-300">404</p>
        <h1 id="notfound-heading" className="mt-4 text-3xl font-bold text-white">
          Page Not Found
        </h1>
        <p className="mt-4 text-surface-300">
          That page doesn&apos;t exist or has moved.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/">
            <Button size="lg">Go Home</Button>
          </Link>
          <Link href="/docs">
            <Button variant="outline" size="lg">View Docs</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
