import type { Metadata } from 'next';
import { DocsBlock, DocsPage } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Enterprise Security',
  'Security controls and review package for enterprise SkillGate deployments.',
  '/docs/enterprise/security',
);

export default function DocsEnterpriseSecurityPage() {
  return (
    <DocsPage
      title="Enterprise Security"
      summary="Security controls, identity boundaries, and incident readiness artifacts for enterprise review."
    >
      <DocsBlock title="Security review pack">
        <ul className="list-disc space-y-2 pl-6">
          <li>Architecture and data flow summary.</li>
          <li>Threat model and hardening controls.</li>
          <li>Identity model (SSO/SAML/OIDC) and RBAC scopes.</li>
          <li>Incident response process and notice templates.</li>
          <li>Subprocessor inventory and update process.</li>
        </ul>
      </DocsBlock>
    </DocsPage>
  );
}
