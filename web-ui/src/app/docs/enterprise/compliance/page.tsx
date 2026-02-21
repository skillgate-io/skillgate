import type { Metadata } from 'next';
import { CodeBlock, DocsBlock, DocsPage } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Enterprise Compliance',
  'Compliance workflows for AI-BOM, EU AI Act evidence, and signed runtime artifacts.',
  '/docs/enterprise/compliance',
);

export default function DocsEnterpriseCompliancePage() {
  return (
    <DocsPage
      title="Enterprise Compliance"
      summary="Compliance workflows for AI inventory, policy enforcement, and runtime provenance evidence."
    >
      <DocsBlock title="Regulatory evidence path">
        <ul className="list-disc space-y-2 pl-6">
          <li>Generate AI-BOM inventories for approved runtime components.</li>
          <li>Attach signed provenance metadata to enforcement decisions.</li>
          <li>Retain session DAG artifacts for audit reconstruction.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Example workflow">
        <CodeBlock
          code={`skillgate bom import ./bom.cyclonedx.json --output .skillgate/bom/approved.json
skillgate run --env strict --skill-id approved-safe-skill --skill-hash <sha256> --scan-attestation valid -- codex exec "review release"
skillgate dag verify .skillgate/runtime/session.json`}
        />
      </DocsBlock>
    </DocsPage>
  );
}
