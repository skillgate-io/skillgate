import type { Metadata } from 'next';
import { DocsBlock, DocsPage } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Enterprise Procurement',
  'Procurement and onboarding checklist for enterprise SkillGate programs.',
  '/docs/enterprise/procurement',
);

export default function DocsEnterpriseProcurementPage() {
  return (
    <DocsPage
      title="Enterprise Procurement"
      summary="Commercial review and onboarding checklist for legal, procurement, security, and platform stakeholders."
    >
      <DocsBlock title="Procurement checklist">
        <ul className="list-disc space-y-2 pl-6">
          <li>Commercial terms and support scope.</li>
          <li>SLA targets for availability and response windows.</li>
          <li>DPA and security addendum review.</li>
          <li>Data retention and deletion scope.</li>
          <li>Escalation contacts and support model.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Onboarding path">
        <ol className="list-decimal space-y-2 pl-6">
          <li>Security review with platform owner and governance team.</li>
          <li>Pilot rollout with explicit acceptance criteria.</li>
          <li>Contracted expansion to organization-wide enforcement lanes.</li>
        </ol>
      </DocsBlock>
    </DocsPage>
  );
}
