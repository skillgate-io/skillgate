import type { Metadata } from 'next';
import { DocsPage, DocsBlock, CodeBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Migrations',
  'Upgrade guidance for self-hosted SkillGate deployments.',
  '/docs/migrations',
);

export default function DocsMigrationsPage() {
  return (
    <DocsPage
      title="Migrations"
      summary="Use these steps to upgrade self-hosted SkillGate safely and predictably."
    >
      <DocsBlock title="Database upgrade flow">
        <CodeBlock
          code={`alembic upgrade head
# optional rollback test in staging:
# alembic downgrade -1
# alembic upgrade head`}
        />
      </DocsBlock>

      <DocsBlock title="Release flow">
        <CodeBlock
          code={`pip install -e ".[api,worker]"
npm --prefix web-ui run build
restart api and worker services`}
        />
      </DocsBlock>

      <DocsBlock title="When to roll back">
        <ul className="list-disc space-y-2 pl-6">
          <li>Core user flows fail after deploy (auth, scan, checkout).</li>
          <li>Migration cannot complete cleanly in production.</li>
          <li>Data integrity checks fail after schema changes.</li>
        </ul>
      </DocsBlock>
    </DocsPage>
  );
}
