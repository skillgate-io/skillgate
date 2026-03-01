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

const DOCS_BASE_URL = (process.env.NEXT_PUBLIC_DOCS_BASE_URL || 'https://docs.skillgate.io').replace(/\/+$/, '');

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
          src="/images/hero-shield.svg"
          alt=""
          aria-hidden="true"
          width={360}
          height={360}
          className="h-36 w-36 rounded-[1.75rem] border border-white/20 object-contain bg-surface-900/40 p-4 shadow-[0_45px_130px_rgba(59,130,246,0.58)] sm:h-44 sm:w-44"
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
            Agent Capability Firewall
          </Badge>

          <h1 id="hero-heading" className="text-white">
            Secure Every AI Tool Before It Executes
            <span className="block text-emerald-300">Runtime Policy Firewall for OpenClaw, Claude Code, Codex CLI & MCP - Block High-Risk Shell, Network & Filesystem Actions in Real Time.</span>
          </h1>
          
          <p className="mt-3 text-sm text-surface-400 sm:text-base">
            Validated on real agent workflows. Full audit trail. Zero friction setup.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-surface-300">
            {['VS Code Extension', 'Python SDK', 'Claude Code', 'Codex CLI', 'MCP Gateway', 'OpenClaw Gateway'].map((label) => (
              <span
                key={label}
                className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1"
              >
                {label}
              </span>
            ))}
          </div>

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
                window.location.href = `${DOCS_BASE_URL}/get-started`;
              }}
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.75 4.75h9.5a2 2 0 012 2v12.5H6.75a2 2 0 01-2-2V4.75z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.75 6.75h2.5a2 2 0 012 2v10.5h-4.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h5M8 13h5M8 16h3.5" />
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
            <pre
              tabIndex={0}
              className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-surface-300"
              aria-label="SkillGate scan terminal output demonstration"
            >
              <code>{`$ skillgate scan ./my-agent-skill --enforce

  SkillGate v1.0.0 | Agent Skill Security Scan

  Scanning: ./my-agent-skill
  Files:    12 (Python, JS, Shell)
  Rules:    120 active

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
