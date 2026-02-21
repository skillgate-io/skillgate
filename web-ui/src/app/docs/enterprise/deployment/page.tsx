import type { Metadata } from 'next';
import { DocsBlock, DocsPage } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Enterprise Deployment',
  'Deployment models and rollout guidance for enterprise SkillGate usage.',
  '/docs/enterprise/deployment',
);

export default function DocsEnterpriseDeploymentPage() {
  return (
    <DocsPage
      title="Enterprise Deployment"
      summary="Choose deployment mode and rollout pattern based on network constraints and control requirements."
    >
      <DocsBlock title="Deployment models">
        <ul className="list-disc space-y-2 pl-6">
          <li>SaaS mode for teams allowing outbound CI calls.</li>
          <li>Private relay mode for restricted-network policy authority.</li>
          <li>Air-gap mode with offline entitlement packs and expiry windows.</li>
          <li>Local mode for developer workstations and evaluation.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Rollout sequence">
        <ol className="list-decimal space-y-2 pl-6">
          <li>Pilot in one repository and one deployment lane.</li>
          <li>Enable runtime wrapper in CI with artifact verification.</li>
          <li>Expand to all critical repositories and promotion paths.</li>
        </ol>
      </DocsBlock>
    </DocsPage>
  );
}
