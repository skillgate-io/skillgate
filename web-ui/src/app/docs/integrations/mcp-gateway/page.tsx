import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsPage, DocsBlock, CodeBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'MCP Gateway Integration',
  'Protect MCP tool calls with trusted provider controls, metadata safety checks, and permission expansion detection.',
  '/docs/integrations/mcp-gateway',
);

export default function DocsMCPIntegrationPage() {
  return (
    <DocsPage
      title="MCP Gateway Integration"
      summary="Keep MCP tool access safe by approving trusted providers and blocking unsafe capability changes."
    >
      <DocsBlock title="Quick start">
        <CodeBlock
          code={`# Approve trusted provider
skillgate mcp allow filesystem \
  --endpoint http://127.0.0.1:8901 \
  --checksum <sha256> \
  --permissions fs.read,fs.write

# Inspect and audit
skillgate mcp inspect filesystem
skillgate mcp audit --limit 50`}
        />
      </DocsBlock>

      <DocsBlock title="Repo scope vs user scope">
        <CodeBlock
          code={`# Repo scope baseline
skillgate mcp settings-check \
  --project-settings .claude/settings.json \
  --global-settings /dev/null \
  --baseline .skillgate/settings-baseline.json \
  --ci

# User scope baseline
skillgate mcp settings-check \
  --project-settings /dev/null \
  --global-settings ~/.claude/settings.json \
  --baseline ~/.skillgate/settings-baseline.json \
  --ci`}
        />
      </DocsBlock>

      <DocsBlock title="What this blocks">
        <ul className="list-disc space-y-2 pl-6">
          <li>Untrusted providers and unknown tool endpoints.</li>
          <li>Tool metadata that contains instruction injection patterns.</li>
          <li>Permission drift that exceeds approved settings baselines.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Related pages">
        <ul className="list-disc space-y-2 pl-6">
          <li><Link href="/docs/runtime-control" className="text-emerald-300 hover:text-emerald-200">Runtime Control</Link></li>
          <li><Link href="/docs/integrations/claude-code" className="text-emerald-300 hover:text-emerald-200">Claude Code Integration</Link></li>
        </ul>
      </DocsBlock>
    </DocsPage>
  );
}
