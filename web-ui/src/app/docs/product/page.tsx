import type { Metadata } from 'next';
import { DocsPage, DocsBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Product Architecture',
  'Understand how SkillGate moves from scan to decision with clear, verifiable outputs.',
  '/docs/product',
);

export default function DocsProductPage() {
  return (
    <DocsPage
      title="Product"
      summary="SkillGate follows a clear pipeline so teams can understand, trust, and act on each decision."
    >
      <DocsBlock title="Pipeline">
        <p>Parse {'->'} Analyze {'->'} Score {'->'} Enforce {'->'} Report {'->'} Sign.</p>
        <p>Each stage is tested and designed for clear, repeatable outcomes.</p>
      </DocsBlock>

      <DocsBlock title="What makes this different">
        <p>SkillGate goes beyond scanning by helping teams make safer release decisions.</p>
        <p>Teams can set environment-specific policy and apply the same standards across repos.</p>
      </DocsBlock>

      <DocsBlock title="Pricing vs Entitlement Matrix">
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/[0.02]">
              <tr>
                <th className="px-4 py-3 font-semibold text-white">Capability</th>
                <th className="px-4 py-3 font-semibold text-white">Free</th>
                <th className="px-4 py-3 font-semibold text-white">Pro</th>
                <th className="px-4 py-3 font-semibold text-white">Team</th>
                <th className="px-4 py-3 font-semibold text-white">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              <tr>
                <td className="px-4 py-3 text-surface-200">Local scan execution</td>
                <td className="px-4 py-3 text-surface-300">Yes</td>
                <td className="px-4 py-3 text-surface-300">Yes</td>
                <td className="px-4 py-3 text-surface-300">Yes</td>
                <td className="px-4 py-3 text-surface-300">Yes</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-surface-200">Scans per day</td>
                <td className="px-4 py-3 text-surface-300">3/day</td>
                <td className="px-4 py-3 text-surface-300">Unlimited</td>
                <td className="px-4 py-3 text-surface-300">Unlimited</td>
                <td className="px-4 py-3 text-surface-300">Unlimited</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-surface-200">Findings returned</td>
                <td className="px-4 py-3 text-surface-300">Top 5</td>
                <td className="px-4 py-3 text-surface-300">All</td>
                <td className="px-4 py-3 text-surface-300">All</td>
                <td className="px-4 py-3 text-surface-300">All</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-surface-200">Policy enforcement</td>
                <td className="px-4 py-3 text-surface-300">No</td>
                <td className="px-4 py-3 text-surface-300">Yes</td>
                <td className="px-4 py-3 text-surface-300">Yes</td>
                <td className="px-4 py-3 text-surface-300">Yes</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-surface-200">Signed attestations</td>
                <td className="px-4 py-3 text-surface-300">No</td>
                <td className="px-4 py-3 text-surface-300">Yes</td>
                <td className="px-4 py-3 text-surface-300">Yes</td>
                <td className="px-4 py-3 text-surface-300">Yes</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-surface-200">CI/CD integration</td>
                <td className="px-4 py-3 text-surface-300">No</td>
                <td className="px-4 py-3 text-surface-300">No</td>
                <td className="px-4 py-3 text-surface-300">Yes</td>
                <td className="px-4 py-3 text-surface-300">Yes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </DocsBlock>

      <DocsBlock title="Core modules">
        <ul className="list-disc space-y-2 pl-6">
          <li>Parser: bundle and manifest discovery.</li>
          <li>Analyzer: AST and pattern rules across languages.</li>
          <li>Scorer: consistent weighted risk score.</li>
          <li>Policy: pass or block decision.</li>
          <li>Signer: Ed25519 attestations.</li>
        </ul>
      </DocsBlock>
    </DocsPage>
  );
}
