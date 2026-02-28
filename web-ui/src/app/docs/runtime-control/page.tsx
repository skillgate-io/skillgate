import type { Metadata } from 'next';
import { CodeBlock, DocsBlock, DocsPage } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Runtime Control',
  'Control local AI agent actions at run time with approvals, limits, and verification steps for OpenClaw, Claude, Codex, and MCP workflows.',
  '/docs/runtime-control',
);

export default function DocsRuntimeControlPage() {
  return (
    <DocsPage
      title="Runtime Control"
      summary="Use Runtime Control to block risky actions during execution, not just during code review."
    >
      <DocsBlock title="Runtime Flow Diagram">
        <p>Every run is checked against policy, approvals, and capability limits before commands execute.</p>
        <CodeBlock
          code={`[Agent Invocation] -> [Gateway Preflight] -> [Policy + Approval Check]
         |                     |                    |
         |                     v                    v
         |              [Tool Classification]   [Budget Validation]
         |                     |                    |
         +---------------------+--------------------+
                               |
                               v
                    [Allow / Block Deterministically]
                               |
                               v
              [Signed Runtime Lineage + Session Artifact]
                               |
                               v
                      [Transitive Risk Scoring]`}
        />
        <p>Most tools alert after the fact. This flow helps your team prevent risky actions before they run.</p>
      </DocsBlock>

      <DocsBlock title="Gateway and run controls">
        <CodeBlock
          code={`# Wrap an agent CLI
skillgate run --env ci -- codex exec "review changed files"

# Native preflight checks
skillgate gateway check --env prod --tool-class shell --target "bash -lc id"`}
        />
      </DocsBlock>

      <DocsBlock title="Capability budgets and approvals">
        <CodeBlock
          code={`# Enforce scoped capability budgets (global/org/session) via env vars
export SKILLGATE_BUDGET_SHELL=0
export SKILLGATE_BUDGET_NETWORK=3
export SKILLGATE_BUDGET_FILESYSTEM=5

# Require signed approvals in hardened flows
skillgate approval sign --skill-id my-skill --skill-hash <sha256> --reviewer sec-a --reviewer sec-b
skillgate approval verify .skillgate/approvals/approval.json --required-reviewers 2`}
        />
      </DocsBlock>

      <DocsBlock title="Lineage and transitive risk">
        <CodeBlock
          code={`# Verify signed runtime session artifact
skillgate dag verify .skillgate/runtime/session.json

# Compute transitive risk metrics
skillgate dag risk .skillgate/runtime/session.json --output json`}
        />
      </DocsBlock>
    </DocsPage>
  );
}
