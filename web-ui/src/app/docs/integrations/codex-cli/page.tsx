import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsPage, DocsBlock, CodeBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Codex CLI Integration',
  'Protect Codex CLI workflows with SkillGate pre-execution checks, trusted provider controls, and CI-safe defaults.',
  '/docs/integrations/codex-cli',
);

export default function DocsCodexIntegrationPage() {
  return (
    <DocsPage
      title="Codex CLI Integration"
      summary="Run Codex through SkillGate so risky actions are blocked before execution."
    >
      <DocsBlock title="Quick start">
        <CodeBlock
          code={`# Repo scope
skillgate codex --directory . exec "review changed files"

# CI mode
skillgate codex --ci --output sarif --directory . exec "run release checks"

# User scope
skillgate codex --directory "$HOME" exec "list active projects"`}
        />
      </DocsBlock>

      <DocsBlock title="Provider trust workflow">
        <CodeBlock
          code={`skillgate codex approve filesystem --permissions fs.read,fs.write --directory .
skillgate codex revoke filesystem --directory .`}
        />
      </DocsBlock>

      <DocsBlock title="What this blocks">
        <ul className="list-disc space-y-2 pl-6">
          <li>Instruction injection in AGENTS.md and Codex instruction files.</li>
          <li>Unsafe config changes that introduce untrusted providers.</li>
          <li>Permission expansion in allowed commands and trusted providers.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Related pages">
        <ul className="list-disc space-y-2 pl-6">
          <li><Link href="/docs/agent-gateway" className="text-emerald-300 hover:text-emerald-200">Agent Gateway</Link></li>
          <li><Link href="/docs/runtime-control" className="text-emerald-300 hover:text-emerald-200">Runtime Control</Link></li>
        </ul>
      </DocsBlock>
    </DocsPage>
  );
}
