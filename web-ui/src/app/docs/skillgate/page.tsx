import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsBlock, DocsPage } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'SkillGate Tool Docs',
  'Dedicated SkillGate documentation for commands, runtime integrations, and configuration.',
  '/docs/skillgate',
);

export default function DocsSkillGateHubPage() {
  return (
    <DocsPage
      title="SkillGate Tool"
      summary="Complete product documentation for the SkillGate CLI and its runtime workflows."
    >
      <DocsBlock title="What you will find here">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <Link href="/docs/skillgate/commands" className="text-emerald-300 hover:text-emerald-200">
              Commands and Subcommands
            </Link>{' '}
            for daily usage, CI pipelines, and incident workflows.
          </li>
          <li>
            <Link
              href="/docs/skillgate/runtime-integrations"
              className="text-emerald-300 hover:text-emerald-200"
            >
              Runtime Integrations
            </Link>{' '}
            with tabs and examples for Codex, Claude Code, Cursor, and Copilot CLI.
          </li>
          <li>
            <Link href="/docs/skillgate/configuration" className="text-emerald-300 hover:text-emerald-200">
              Configuration
            </Link>{' '}
            for policy presets, runtime environments, and enforcement defaults.
          </li>
          <li>
            <Link
              href="/docs/skillgate/enforcement-boundaries"
              className="text-emerald-300 hover:text-emerald-200"
            >
              Guarantees and Org Controls
            </Link>{' '}
            to understand what SkillGate enforces directly and what your CI/platform must enforce.
          </li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Core command workflow">
        <ol className="list-decimal space-y-2 pl-6">
          <li>Initialize policy with `skillgate init`.</li>
          <li>Scan and enforce with `skillgate scan --enforce`.</li>
          <li>Wrap runtime execution with `skillgate run -- &lt;agent-cli&gt;`.</li>
          <li>Verify runtime and scan artifacts with `skillgate verify` and `skillgate dag verify`.</li>
        </ol>
      </DocsBlock>
    </DocsPage>
  );
}
