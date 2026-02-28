import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsPage, DocsBlock, CodeBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Claude Code Integration',
  'Protect Claude Code workflows with SkillGate policy checks for hooks, settings, plugins, and instruction files.',
  '/docs/integrations/claude-code',
);

export default function DocsClaudeIntegrationPage() {
  return (
    <DocsPage
      title="Claude Code Integration"
      summary="Apply SkillGate guardrails to Claude workflows before risky operations execute."
    >
      <DocsBlock title="Quick start">
        <CodeBlock
          code={`# Repo scope
skillgate claude scan --directory . --surface all --output json
skillgate run --env ci -- claude -p "review this pull request"

# User scope
skillgate claude scan --directory ~/.claude --surface settings,instruction-files --output json`}
        />
      </DocsBlock>

      <DocsBlock title="What this protects">
        <ul className="list-disc space-y-2 pl-6">
          <li>Hook and plugin paths that can trigger high-risk operations.</li>
          <li>Instruction files such as CLAUDE.md and AGENTS.md.</li>
          <li>Settings changes that silently expand tool permissions.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Related pages">
        <ul className="list-disc space-y-2 pl-6">
          <li><Link href="/docs/agent-gateway" className="text-emerald-300 hover:text-emerald-200">Agent Gateway</Link></li>
          <li><Link href="/docs/skillgate/runtime-integrations" className="text-emerald-300 hover:text-emerald-200">Runtime Integrations</Link></li>
        </ul>
      </DocsBlock>
    </DocsPage>
  );
}
