import type { Metadata } from 'next';
import { DocsPage, DocsBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Artifact Coverage',
  'What SkillGate scans beyond source code: markdown, configs, documents, and archives.',
  '/docs/artifacts',
);

export default function DocsArtifactsPage() {
  return (
    <DocsPage
      title="Artifact Coverage"
      summary="SkillGate scans source and non-source artifacts with provenance so policy and CI decisions remain auditable."
    >
      <DocsBlock title="Supported artifacts">
        <ul className="list-disc space-y-2 pl-6">
          <li>Markdown prose and fenced code blocks.</li>
          <li>Config files: JSON, YAML, TOML, ENV.</li>
          <li>Documents: PDF and DOCX (text-only extraction).</li>
          <li>Archives: ZIP with depth and size limits.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Provenance and policy">
        <ul className="list-disc space-y-2 pl-6">
          <li>Every finding is tagged by origin type (code, document_text, archive_member, config, markdown).</li>
          <li>Origin-aware policy allows per-origin severity floors and blocked categories.</li>
          <li>SARIF and JSON include provenance fields for traceability in CI and audits.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Safety and performance controls">
        <ul className="list-disc space-y-2 pl-6">
          <li>Archive traversal is bounded by depth and extraction budget.</li>
          <li>Large files are skipped with explicit warnings.</li>
          <li>Unicode normalization and confusable folding are applied before analysis.</li>
        </ul>
      </DocsBlock>
    </DocsPage>
  );
}
