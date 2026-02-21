import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsPage, DocsBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Security',
  'Threat model, hardening controls, and disclosure process for SkillGate.',
  '/docs/security',
);

export default function DocsSecurityPage() {
  return (
    <DocsPage
      title="Security"
      summary="Security defaults are strict: clear data handling, predictable outcomes, and no silent bypasses."
    >
      <DocsBlock title="Baseline controls">
        <ul className="list-disc space-y-2 pl-6">
          <li>Local scan mode does not execute skill code.</li>
          <li>Policy decisions are consistent and testable.</li>
          <li>Signed attestations prove report integrity.</li>
          <li>Hosted API uses request IDs, typed errors, and rate limiting.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Responsible disclosure">
        <p>Report security issues to support@skillgate.io with repro steps and impact.</p>
        <p>We confirm receipt within one business day and send status updates on every milestone.</p>
      </DocsBlock>

      <DocsBlock title="Security documents">
        <p>
          Read full details in <Link href="/docs/legal" className="text-emerald-300 hover:text-emerald-200">Legal docs</Link> and
          in the repository security documentation.
        </p>
      </DocsBlock>
    </DocsPage>
  );
}
