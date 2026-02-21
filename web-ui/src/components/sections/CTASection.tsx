/* CTA section — bottom of page conversion */
'use client';

import { Button } from '@/components/ui/Button';
import { trackEvent } from '@/lib/analytics';

export function CTASection() {
  return (
    <section
      className="relative overflow-hidden bg-[#06090f] py-20 sm:py-28"
      aria-labelledby="cta-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(76,110,245,0.18),transparent_35%),radial-gradient(circle_at_78%_80%,rgba(16,185,129,0.18),transparent_35%)]" />
      <div className="mx-auto max-w-content px-4 text-center sm:px-6 lg:px-8">
        <h2 id="cta-heading" className="text-3xl font-bold text-white sm:text-4xl">
          Start safer AI agent releases today
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-surface-300">
          Install in minutes, run your first protected scan, and share results your team can trust.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            className="bg-white text-surface-900 hover:bg-surface-100 active:bg-surface-200"
            onClick={() => {
              trackEvent('signup_cta_click', 'bottom_cta');
              window.location.href = '/signup';
            }}
          >
            Start Free
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="border-white/30 text-white hover:bg-white/10"
            onClick={() => {
              trackEvent('docs_click', 'bottom_cta');
              window.location.href = '/docs/get-started';
            }}
          >
            See Setup Steps
          </Button>
        </div>

        {/* Quick start code */}
        <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-white/15 bg-white/[0.04] p-4 font-mono text-sm text-surface-200 backdrop-blur">
          <div className="space-y-1 text-left">
            <p><span className="text-emerald-300">#</span> Install</p>
            <p>pip install skillgate</p>
            <p className="mt-3"><span className="text-emerald-300">#</span> Scan a skill</p>
            <p>skillgate scan ./my-skill --enforce</p>
            <p className="mt-3"><span className="text-emerald-300">#</span> Verify a signed report</p>
            <p>skillgate verify report.json</p>
          </div>
        </div>
      </div>
    </section>
  );
}
