/* Hero section — main landing page above the fold */
'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { trackEvent } from '@/lib/analytics';
import dynamic from 'next/dynamic';

const ThreatTear = dynamic(() => import('@/components/hero/ThreatTear'), {
  ssr: false,
  loading: () => null,
});

export function HeroSection() {
  return (
    <section
      className="relative overflow-hidden bg-surface-950"
      aria-labelledby="hero-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(76,110,245,0.22),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.20),transparent_40%)]" />
      {/* Logo — mobile/no-JS fallback; hidden on lg+ where ThreatTear replaces it */}
      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 opacity-100 lg:hidden">
        <div className="absolute inset-0 -z-10 rounded-[2rem] bg-[radial-gradient(circle,rgba(96,165,250,0.48),rgba(34,197,94,0.15),transparent_72%)] blur-2xl" />
        <Image
          src="/images/logo.jpg"
          alt=""
          aria-hidden="true"
          width={360}
          height={360}
          className="h-36 w-36 rounded-[1.75rem] border border-white/20 object-cover shadow-[0_45px_130px_rgba(59,130,246,0.58)] sm:h-44 sm:w-44"
          priority
        />
      </div>

      {/* ThreatTear — desktop only; dynamically loaded, ssr:false */}
      <div className="pointer-events-none absolute inset-x-0 top-0 hidden lg:block" aria-hidden="true">
        <ThreatTear />
      </div>
      <div className="mx-auto max-w-content px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
        <div className="relative mx-auto max-w-3xl pt-20 text-center sm:pt-24 lg:pt-28">
          {/* Announcement badge */}
          <Badge variant="brand" className="mb-6">
            AI Agent Safety for Teams
          </Badge>

          <h1 id="hero-heading" className="text-white">
            Block risky AI agent changes before they ship
            <span className="block text-emerald-300">From pull requests to production runs</span>
          </h1>

          <p className="mt-6 text-lg leading-8 text-surface-300 sm:text-xl">
            SkillGate helps your team catch unsafe behavior early, block risky actions,
            and keep a clear record of what happened and why.
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              onClick={() => {
                trackEvent('signup_cta_click', 'hero_primary');
                window.location.href = '/signup';
              }}
            >
              Start Free
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="border-white/70 text-white hover:bg-white/10 active:bg-white/20"
              onClick={() => {
                trackEvent('docs_click', 'hero_scan_skill');
                window.location.href = '/docs/get-started';
              }}
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.164 6.839 9.49.5.09.682-.218.682-.483 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.16 22 16.42 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              See Setup Steps
            </Button>
          </div>
          <p className="mt-2 text-xs text-surface-500">No credit card required</p>

        </div>

        {/* Terminal demo */}
        <div className="mx-auto mt-16 max-w-2xl">
          <div className="overflow-hidden rounded-xl border border-white/20 bg-[#090c13] shadow-[0_30px_100px_rgba(9,12,19,0.9)]">
            {/* Terminal titlebar */}
            <div className="flex items-center gap-2 border-b border-surface-800 px-4 py-2.5">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="ml-2 text-xs text-surface-500">Terminal</span>
            </div>
            {/* Terminal content */}
            <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-surface-300" aria-label="SkillGate scan terminal output demonstration">
              <code>{`$ skillgate scan ./my-agent-skill --enforce

  SkillGate v1.0.0 | Agent Skill Security Scan

  Scanning: ./my-agent-skill
  Files:    12 (Python, JS, Shell)
  Rules:    119 active

  ⚠  SG-SHELL-001  subprocess.run() with shell=True  main.py:23
  ⚠  SG-NET-001    urllib.request to external URL     fetch.py:45
  ✕  SG-CRED-001   Hardcoded API key detected         config.py:12
  ✕  SG-EVAL-001   eval() with user input             handler.py:67

  Risk Score: 74/200 (Medium)
  Policy:     FAIL: 2 critical findings exceed threshold

  ✕ Deployment blocked. Fix critical findings to proceed.`}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
