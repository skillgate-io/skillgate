import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsPage, DocsBlock, CodeBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'CLI Reference',
  'SkillGate CLI commands and exit codes for CI usage.',
  '/docs/cli',
);

const commandRows = [
  ['skillgate scan <path>', 'Scan a bundle'],
  ['skillgate scan --enforce', 'Exit with code 1 on policy violation'],
  ['skillgate scan --format sarif', 'Generate SARIF for code scanning tools'],
  ['skillgate init --preset production', 'Create baseline policy file'],
  ['skillgate verify report.json', 'Verify signed report'],
  ['skillgate keys generate', 'Create signing keys'],
  ['skillgate run -- <agent-cli-command>', 'Runtime gateway wrapper for agent CLIs'],
  ['skillgate bom import <cyclonedx.json>', 'Import a trusted component manifest for runtime checks'],
  ['skillgate dag verify <session.json>', 'Verify signed runtime session artifacts'],
] as const;

export default function DocsCliPage() {
  return (
    <DocsPage
      title="CLI"
      summary="These commands are stable and CI-tested. Use them directly in scripts and pipelines."
    >
      <DocsBlock title="Commands">
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04]">
              <tr>
                <th className="px-4 py-3 text-surface-300">Command</th>
                <th className="px-4 py-3 text-surface-300">Use</th>
              </tr>
            </thead>
            <tbody>
              {commandRows.map(([command, use]) => (
                <tr key={command} className="border-t border-white/10">
                  <td className="px-4 py-3 font-mono text-emerald-300">{command}</td>
                  <td className="px-4 py-3 text-surface-300">{use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocsBlock>

      <DocsBlock title="Exit codes">
        <CodeBlock code={`0  success
1  policy violation
2  internal error
3  invalid input`} />
      </DocsBlock>

      <DocsBlock title="Runtime gateway">
        <p>
          For full `skillgate run` usage and troubleshooting examples, use the dedicated{' '}
          <Link href="/docs/agent-gateway" className="text-emerald-300 hover:text-emerald-200">
            Agent Gateway
          </Link>{' '}
          page and the{' '}
          <Link
            href="/docs/skillgate/runtime-integrations"
            className="text-emerald-300 hover:text-emerald-200"
          >
            Runtime Integrations
          </Link>{' '}
          tabbed examples.
        </p>
      </DocsBlock>
    </DocsPage>
  );
}
