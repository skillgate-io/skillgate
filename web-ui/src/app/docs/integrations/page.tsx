import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsPage, DocsBlock, CodeBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Integrations',
  'Integrate SkillGate with OpenClaw, Codex CLI, Claude Code, MCP Gateway, GitHub Actions, and GitLab CI.',
  '/docs/integrations',
);

const INTEGRATIONS = [
  {
    href: '/docs/integrations/vscode-extension',
    title: 'VS Code Extension',
    desc: 'Get early editor feedback for Claude Code and Codex workspaces with a guided setup flow.',
  },
  {
    href: '/docs/integrations/python-sdk',
    title: 'Python SDK',
    desc: 'Protect app tool calls before they run, with clear policy outcomes your team can act on.',
  },
  {
    href: '/docs/integrations/codex-cli',
    title: 'Codex CLI',
    desc: 'Protect Codex runs with pre-execution checks, trusted providers, and CI-safe defaults.',
  },
  {
    href: '/docs/integrations/claude-code',
    title: 'Claude Code',
    desc: 'Protect Claude hooks, settings, plugins, and instruction files before risky actions run.',
  },
  {
    href: '/docs/integrations/mcp-gateway',
    title: 'MCP Gateway',
    desc: 'Approve trusted MCP providers and block unsafe metadata or permission expansion.',
  },
  {
    href: '/docs/agent-gateway',
    title: 'GitHub Actions',
    desc: 'Block pull requests on policy violations and publish SARIF findings.',
  },
  {
    href: '/docs/agent-gateway',
    title: 'GitLab CI',
    desc: 'Gate merge pipelines with SkillGate policy enforcement and report artifacts.',
  },
];

export default function DocsIntegrationsPage() {
  return (
    <DocsPage
      title="Integrations"
      summary="Choose your stack and enforce SkillGate where your team actually runs AI agents."
    >
      <DocsBlock title="Integration guides">
        <div className="grid gap-3 md:grid-cols-2">
          {INTEGRATIONS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25 hover:bg-white/[0.05]"
            >
              <p className="text-sm font-semibold text-emerald-300">{item.title}</p>
              <p className="mt-1 text-sm text-surface-400">{item.desc}</p>
            </Link>
          ))}
        </div>
      </DocsBlock>

      <DocsBlock title="Enterprise onboarding flow">
        <CodeBlock
          code={`1) Install surface:
   - VS Code extension for shift-left diagnostics
   - skillgate-sdk for runtime-enforced app tools
2) Run preflight:
   - CLI present
   - auth session valid
   - local sidecar reachable
3) Gate only runtime/auth-dependent actions:
   - simulation, approvals, live decisions
   - keep static diagnostics active even when runtime is offline`}
        />
      </DocsBlock>

      <DocsBlock title="Architecture at a glance">
        <CodeBlock
          code={`Editor (VS Code) -> local preflight -> sidecar /v1/decide
Python tool (@enforce) -> sidecar /v1/decide
Sidecar -> policy + budgets + approval logic
Outputs -> ALLOW | DENY | REQUIRE_APPROVAL + signed evidence`}
        />
      </DocsBlock>

      <DocsBlock title="GitHub Actions">
        <CodeBlock
          code={`name: SkillGate
on: [pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: skillgate/scan-action@v1
        with:
          policy: production
          enforce: true`}
        />
      </DocsBlock>

      <DocsBlock title="GitLab CI">
        <CodeBlock
          code={`skillgate_scan:
  image: python:3.12
  script:
    - pip install skillgate
    - skillgate scan ./ --enforce --policy production`}
        />
      </DocsBlock>

      <DocsBlock title="Webhook and alerts">
        <p>Use `/api/v1/alerts` for delivery to Slack or your paging system.</p>
        <p>Set retry, DLQ, and replay policies before enabling production alerts.</p>
      </DocsBlock>

      <DocsBlock title="Other agent runtimes">
        <p>
          Running OpenClaw or another local agent runtime? Use{' '}
          <code>skillgate run -- &lt;agent-cli-command&gt;</code> to apply the same guardrails.
        </p>
      </DocsBlock>
    </DocsPage>
  );
}
