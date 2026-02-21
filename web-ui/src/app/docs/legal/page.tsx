import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsPage, DocsBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Legal Center',
  'DPA, security addendum, subprocessors, and incident notice templates.',
  '/docs/legal',
);

export default function DocsLegalPage() {
  return (
    <DocsPage
      title="Legal"
      summary="Use these pages during vendor review and procurement. Keep legal and security in the same review thread."
    >
      <DocsBlock title="Legal templates">
        <ul className="list-disc space-y-2 pl-6">
          <li><Link href="/legal/dpa-template" className="text-emerald-300 hover:text-emerald-200">Data Processing Addendum template</Link></li>
          <li><Link href="/legal/security-addendum-template" className="text-emerald-300 hover:text-emerald-200">Security Addendum template</Link></li>
          <li><Link href="/legal/subprocessors" className="text-emerald-300 hover:text-emerald-200">Subprocessors list</Link></li>
          <li><Link href="/legal/incident-notice-template" className="text-emerald-300 hover:text-emerald-200">Incident notice template</Link></li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Contracting checks">
        <ul className="list-disc space-y-2 pl-6">
          <li>Confirm data retention and deletion windows.</li>
          <li>Confirm incident notice timing and contact path.</li>
          <li>Confirm subprocessor update notice process.</li>
          <li>Confirm security testing and remediation cadence.</li>
        </ul>
      </DocsBlock>
    </DocsPage>
  );
}
