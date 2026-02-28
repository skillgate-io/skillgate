/* Features page — dedicated feature breakdown */

import type { Metadata } from 'next';
import Link from 'next/link';
import { FeaturesSection } from '@/components/sections/FeaturesSection';
import { CTASection } from '@/components/sections/CTASection';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Features',
  'Explore features that protect local AI agents, OpenClaw gateways, Claude Code, Codex CLI, and MCP workflows.',
  '/features',
);

export default function FeaturesPage() {
  return (
    <>
      <div className="relative overflow-hidden bg-[#05070b] py-16 text-center sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(76,110,245,0.2),transparent_35%),radial-gradient(circle_at_80%_90%,rgba(16,185,129,0.15),transparent_35%)]" />
        <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
          <h1 className="text-white">
            Built for Real AI Agent Security
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-surface-300">
            Practical controls for local scans, CI checks, and production workflows,
            with clear evidence your team can review.
          </p>
        </div>
      </div>

      <FeaturesSection />

      <section className="bg-[#06090f] py-16" aria-labelledby="moat-coverage-heading">
        <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
          <h2 id="moat-coverage-heading" className="text-center text-white">Moat Coverage</h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-surface-300">
            Each protection layer has a dedicated guide so teams can deploy it in local development and CI.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { title: 'Runtime Sidecar Controls', desc: 'Interception and policy checks before shell, network, and filesystem actions.', href: '/docs/runtime-control' },
              { title: 'Agent Gateway Wrapper', desc: 'Guard OpenClaw and other local AI agents through skillgate run.', href: '/docs/agent-gateway' },
              { title: 'Codex CLI Protection', desc: 'Config safety checks, provider trust controls, and CI hardening.', href: '/docs/integrations/codex-cli' },
              { title: 'Claude Code Protection', desc: 'Instruction, hooks, plugins, and settings safety controls.', href: '/docs/integrations/claude-code' },
              { title: 'MCP Gateway Protection', desc: 'Trusted provider allowlists, metadata safety, and permission drift checks.', href: '/docs/integrations/mcp-gateway' },
              { title: 'Signed Security Evidence', desc: 'Signed session records and SARIF output for CI and audit.', href: '/docs/skillgate/enforcement-boundaries' },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 text-surface-200 transition hover:border-white/25 hover:bg-white/[0.06]"
              >
                <h3 className="text-base font-semibold text-emerald-300">{item.title}</h3>
                <p className="mt-2 text-sm text-surface-400">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Rule categories breakdown */}
      <section className="bg-[#070a12] py-20" aria-labelledby="rules-heading">
        <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
          <h2 id="rules-heading" className="text-center text-white">
            Detection Rule Categories
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-surface-300">
            Every rule has an ID, severity, weight, and clear description.
            No hidden scoring.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { id: 'SG-SHELL-*', name: 'Shell Execution', count: '15+', desc: 'subprocess, system(), exec, backticks, popen' },
              { id: 'SG-NET-*', name: 'Network Access', count: '12+', desc: 'HTTP clients, raw sockets, server listeners' },
              { id: 'SG-FS-*', name: 'Filesystem', count: '12+', desc: 'File writes, deletions, path traversal' },
              { id: 'SG-EVAL-*', name: 'Dynamic Execution', count: '12+', desc: 'eval, exec, unsafe blocks, dynamic loading' },
              { id: 'SG-CRED-*', name: 'Credential Access', count: '12+', desc: 'ENV access, hardcoded keys, secrets' },
              { id: 'SG-INJ-*', name: 'Code Injection', count: '7+', desc: 'SQL injection, template injection, format strings' },
              { id: 'SG-OBF-*', name: 'Obfuscation', count: '5+', desc: 'Base64 encoding, hex encoding, char codes' },
            ].map((cat) => (
              <div key={cat.id} className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 text-surface-200 backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-300">{cat.id}</span>
                  <span className="text-sm font-medium text-surface-400">{cat.count} rules</span>
                </div>
                <h3 className="mt-2 text-lg font-semibold text-white">{cat.name}</h3>
                <p className="mt-1 text-sm text-surface-400">{cat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Language support */}
      <section className="bg-[#04060b] py-20" aria-labelledby="languages-heading">
        <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
          <h2 id="languages-heading" className="text-center text-white">
            Language Coverage
          </h2>
          <div className="mt-12 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-7">
            {['Python', 'JavaScript', 'TypeScript', 'Shell', 'Go', 'Rust', 'Ruby'].map((lang) => (
              <div
                key={lang}
                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center"
              >
                <span className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300">
                  {lang.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-sm font-medium text-surface-200">{lang}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
