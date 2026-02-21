import type { Metadata } from 'next';
import { CodeBlock, DocsBlock, DocsPage } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'SkillGate Configuration',
  'Policy and runtime configuration reference for SkillGate CLI.',
  '/docs/skillgate/configuration',
);

export default function DocsSkillGateConfigurationPage() {
  return (
    <DocsPage
      title="Configuration"
      summary="Use policy presets or `skillgate.yml` to control scan-time and runtime behavior."
    >
      <DocsBlock title="Policy presets">
        <CodeBlock
          code={`# Built-in presets
skillgate scan ./bundle --policy development
skillgate scan ./bundle --policy production --enforce
skillgate scan ./bundle --policy strict --enforce`}
        />
      </DocsBlock>

      <DocsBlock title="Runtime block in skillgate.yml">
        <CodeBlock
          code={`version: "1"
name: production
runtime:
  environment: ci
  enable_top_guard: true
  top_guard_default_action: block
  trust_propagation: inherit`}
        />
      </DocsBlock>

      <DocsBlock title="Environment model">
        <ul className="list-disc space-y-2 pl-6">
          <li>`dev`: permissive, warning-oriented defaults.</li>
          <li>`ci`: fail-closed for high/critical actions.</li>
          <li>`prod`: strict runtime blocking, production-safe defaults.</li>
          <li>`strict`: maximum blocking for all severities.</li>
        </ul>
      </DocsBlock>
    </DocsPage>
  );
}
