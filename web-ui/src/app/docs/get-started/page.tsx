import type { Metadata } from 'next';
import { DocsPage, DocsBlock, CodeBlock } from '@/components/docs/DocsPage';
import { InstallWizard } from '@/components/docs/InstallWizard';
import { loadInstallSpec } from '@/lib/install-spec';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Get Started',
  'Install SkillGate with Python or NPX, run your first scan, and verify trusted results.',
  '/docs/get-started',
);

export default async function DocsGetStartedPage() {
  const installSpec = await loadInstallSpec();

  return (
    <DocsPage
      title="Get Started"
      summary="Install in minutes, run an enforced scan, and verify results you can trust."
    >
      <DocsBlock title="1) Install (Interactive Wizard)">
        <InstallWizard spec={installSpec} />
      </DocsBlock>

      <DocsBlock title="2) Pick your execution path">
        <p className="font-semibold text-white">Python path (recommended)</p>
        <CodeBlock
          code={`pipx install skillgate
skillgate version`}
        />
        <p className="font-semibold text-white">NPX path (quick onboarding)</p>
        <CodeBlock
          code={`npm install -g @skillgate-io/cli
skillgate version
# one-off without global install:
npx @skillgate-io/cli version`}
        />
      </DocsBlock>

      <DocsBlock title="3) Create policy file">
        <CodeBlock code={`skillgate init --preset production`} />
      </DocsBlock>

      <DocsBlock title="4) Scan and enforce">
        <CodeBlock
          code={`skillgate scan ./my-agent-skill --enforce --policy production
skillgate scan ./my-agent-skill --format sarif --output skillgate.sarif`}
        />
      </DocsBlock>

      <DocsBlock title="5) Sign and verify report">
        <CodeBlock
          code={`skillgate keys generate
skillgate scan ./my-agent-skill --sign --output report.json
skillgate verify report.json`}
        />
      </DocsBlock>
    </DocsPage>
  );
}
