import type { Metadata } from 'next';
import { CodeBlock, DocsBlock, DocsPage } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Intelligence',
  'Use threat and reputation context to prioritize findings and respond faster.',
  '/docs/intelligence',
);

export default function DocsIntelligencePage() {
  return (
    <DocsPage
      title="Intelligence"
      summary="Connect individual findings into a broader risk picture so teams can prioritize what matters."
    >
      <DocsBlock title="Intelligence Flow Diagram">
        <p>Use this flow to add context to findings while keeping decisions clear and reviewable.</p>
        <CodeBlock
          code={`[Bundle Hash + Findings] -> [Reputation Check] -> [Confidence Banding]
           |                    |                    |
           v                    v                    v
    [Signed Submission]   [Cross-Org Signals]   [Risk Enrichment]
           |                    |                    |
           +--------------------+--------------------+
                                |
                                v
                     [Policy Decision + Explain]
                                |
                                v
                     [Hunt + Retro + Reporting]`}
        />
        <p>This helps your team move from isolated alerts to actionable risk context.</p>
      </DocsBlock>

      <DocsBlock title="Reputation graph workflows">
        <CodeBlock
          code={`# Verify signed reputation data
skillgate reputation verify .skillgate/reputation/reputation.json

# Evaluate one bundle hash
skillgate reputation check --bundle-hash <sha256> --env prod --store .skillgate/reputation/reputation.json

# Create signed anonymized submission event
skillgate reputation submit --bundle-hash <sha256> --verdict suspicious --anonymized`}
        />
      </DocsBlock>

      <DocsBlock title="Executive explanation profile">
        <CodeBlock
          code={`# Emit deterministic CISO-style summaries
skillgate scan ./my-agent-skill --explain --explain-mode executive --output json`}
        />
      </DocsBlock>

      <DocsBlock title="Retro and hunt workflows">
        <CodeBlock
          code={`# Query historical scan data
skillgate hunt --query "severity >= high AND rule =~ SG-CRED-*"

# Replay historical reports with updated rules
skillgate retroscan --input ./reports --output ./retroscan-results`}
        />
      </DocsBlock>
    </DocsPage>
  );
}
