import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsPage, DocsBlock, CodeBlock } from '@/components/docs/DocsPage';
import { DOCS_NAV } from '@/lib/docs-nav';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Docs Overview',
  'SkillGate docs hub with clear setup paths, practical command guides, and enterprise rollout help.',
  '/docs',
);

export default function DocsOverviewPage() {
  return (
    <DocsPage
      title="Documentation"
      summary="Set up SkillGate quickly, run your first policy check, and scale to team workflows."
    >
      <DocsBlock title="Quick Start Paths">
        <p>Choose the path that matches your team workflow, then enforce in CI.</p>
        <CodeBlock
          code={`# Python path (recommended)
pipx install skillgate
skillgate init --preset production
skillgate scan ./my-agent-skill --enforce --policy production`}
        />
        <CodeBlock
          code={`# NPX path (quick start)
npx @skillgate-io/cli version
npx @skillgate-io/cli scan ./my-agent-skill --enforce --policy production`}
        />
        <p className="pt-2">
          Running agents in production? Start with <Link href="/docs/agent-gateway" className="text-emerald-300 hover:text-emerald-200">Agent Gateway docs</Link>.
        </p>
      </DocsBlock>

      <DocsBlock title="Agent platform guides">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { href: '/docs/integrations/vscode-extension', label: 'VS Code Extension', desc: 'Catch risky changes early in your editor with a guided setup flow.' },
            { href: '/docs/integrations/python-sdk', label: 'Python SDK Integration', desc: 'Protect app tools before execution with clear allow, deny, or approval outcomes.' },
            { href: '/docs/integrations/codex-cli', label: 'Codex CLI Integration', desc: 'Guard Codex runs with trusted provider and config safety checks.' },
            { href: '/docs/integrations/claude-code', label: 'Claude Code Integration', desc: 'Protect hooks, instruction files, plugin surfaces, and settings.' },
            { href: '/docs/integrations/mcp-gateway', label: 'MCP Gateway Integration', desc: 'Approve trusted MCP providers and block tool metadata injection.' },
            { href: '/docs/skillgate/runtime-integrations', label: 'Runtime Integrations', desc: 'Practical guides for Codex, Claude, and other agent CLIs.' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25 hover:bg-white/[0.05]"
            >
              <p className="text-sm font-semibold text-emerald-300">{item.label}</p>
              <p className="mt-1 text-sm text-surface-400">{item.desc}</p>
            </Link>
          ))}
        </div>
      </DocsBlock>

      <DocsBlock title="Browse by team">
        <div className="grid gap-3 md:grid-cols-2">
          {DOCS_NAV.filter((item) => item.href !== '/docs').map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25 hover:bg-white/[0.05]"
            >
              <p className="text-sm font-semibold text-emerald-300">{item.title}</p>
              <p className="mt-1 text-sm text-surface-400">{item.summary}</p>
            </Link>
          ))}
        </div>
      </DocsBlock>
    </DocsPage>
  );
}
