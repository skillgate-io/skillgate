import type { Metadata } from 'next';
import { CodeBlock, DocsBlock, DocsPage } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Governance',
  'Manage policy consistently across repos and teams with simulation and drift checks.',
  '/docs/governance',
);

export default function DocsGovernancePage() {
  return (
    <DocsPage
      title="Governance"
      summary="Use one policy approach across repos, bundles, and teams so releases stay consistent."
    >
      <DocsBlock title="Governance Flow Diagram">
        <p>Use this flow to preview impact before rollout and reduce surprise failures in CI.</p>
        <CodeBlock
          code={`[Org Selector] -> [Repo/Bundles Discovery] -> [Static Scan Engine]
                       |                      |
                       |                      v
                       +---------------> [Policy Simulation]
                                              |
                                              v
                                  [Fail Rate + Noise Estimate]
                                              |
                                              v
                                    [Enforce in CI Gate]
                                              |
                                              v
                                   [Signed Governance Record]`}
        />
        <p>This helps teams roll out policy changes safely across large repo fleets.</p>
      </DocsBlock>

      <DocsBlock title="Fleet scans">
        <CodeBlock
          code={`# Scan all bundles under a root with deterministic per-bundle isolation
skillgate scan ./agents --fleet --policy production --output json

# Harden fleet structure and CI behavior
skillgate scan ./agents --fleet --require-skill-manifest --fail-on-threshold 10`}
        />
      </DocsBlock>

      <DocsBlock title="Org-scale simulation">
        <CodeBlock
          code={`# Local org selector
skillgate simulate --org "./repos/acme/*" --policy strict --output json

# Provider selector
skillgate simulate --org "github:acme/*" --policy production --output json

# Self-hosted forge selector
skillgate simulate --org "forge:gitlab.acme.local/platform/*" --policy production --output json`}
        />
        <p>
          Track repos affected, top failing controls, and expected noise to plan safer rollouts.
        </p>
      </DocsBlock>

      <DocsBlock title="Drift baseline and checks">
        <CodeBlock
          code={`# Capture baseline
skillgate drift baseline ./agents --fleet --output .skillgate/drift/baseline.json

# Gate CI on drift
skillgate drift check ./agents --fleet --baseline .skillgate/drift/baseline.json --fail-on-drift`}
        />
      </DocsBlock>
    </DocsPage>
  );
}
