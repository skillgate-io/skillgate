import type { Metadata } from 'next';
import { DocsPage, DocsBlock, CodeBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Operations',
  'Operational guidance for teams running SkillGate in production.',
  '/docs/operations',
);

export default function DocsOperationsPage() {
  return (
    <DocsPage
      title="Operations"
      summary="Use this page to run SkillGate in production with a practical reliability checklist."
    >
      <DocsBlock title="Operational checklist">
        <ul className="list-disc space-y-2 pl-6">
          <li>Monitor API health and background worker status continuously.</li>
          <li>Track failed webhooks and verify retry behavior.</li>
          <li>Alert on authentication, billing, and verification failures.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Recommended daily checks">
        <CodeBlock
          code={`curl -fsS https://<your-api-domain>/api/v1/health
curl -fsS https://<your-api-domain>/api/v1/payments/health
curl -fsS https://<your-api-domain>/api/v1/entitlements/health`}
        />
      </DocsBlock>

      <DocsBlock title="Incident readiness">
        <ul className="list-disc space-y-2 pl-6">
          <li>Document rollback ownership and clear approval path.</li>
          <li>Run canary checks before full rollout.</li>
          <li>Keep support escalation contacts current.</li>
        </ul>
      </DocsBlock>
    </DocsPage>
  );
}
