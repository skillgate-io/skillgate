import type { Metadata } from 'next';
import { DocsPage, DocsBlock, CodeBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Integrations',
  'CI and workflow integrations for GitHub, GitLab, and alerting.',
  '/docs/integrations',
);

export default function DocsIntegrationsPage() {
  return (
    <DocsPage
      title="Integrations"
      summary="Connect SkillGate to CI and alerts so policy gates stay on your merge and deploy paths."
    >
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
    </DocsPage>
  );
}
