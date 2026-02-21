import type { Metadata } from 'next';
import Link from 'next/link';
import { CodeBlock, DocsBlock, DocsPage } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'SkillGate Guarantees and Org Controls',
  'What SkillGate guarantees when used, what requires CI/platform enforcement, and how to deploy bypass-resistant controls.',
  '/docs/skillgate/enforcement-boundaries',
);

export default function DocsEnforcementBoundariesPage() {
  return (
    <DocsPage
      title="Guarantees and Org Controls"
      summary="SkillGate enforces strong runtime and policy controls when execution goes through SkillGate. For bypass resistance, enforce wrapper-only execution in CI and deployment policy."
    >
      <DocsBlock title="What SkillGate guarantees">
        <ul className="list-disc space-y-2 pl-6">
          <li>Deterministic pre-execution checks before wrapped command execution.</li>
          <li>Mandatory provenance gates in `ci`/`prod`/`strict` runtime modes.</li>
          <li>Sandboxed execution adapters (`process`, `bwrap`, `nsjail`) with signed decisions.</li>
          <li>TOP guard output scanning before re-injection to the agent.</li>
          <li>Signed session artifacts and DAG lineage verification.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="What SkillGate does not guarantee alone">
        <ul className="list-disc space-y-2 pl-6">
          <li>It cannot stop direct, unwrapped tool execution outside SkillGate entrypoints.</li>
          <li>Workflow text scans and wrapper checks are assurance controls, not hard isolation by themselves.</li>
          <li>Absolute bypass prevention requires CI and execution infrastructure policy.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Required org controls for bypass resistance">
        <ol className="list-decimal space-y-2 pl-6">
          <li>Deny by default in CI: fail when agent invocations are not wrapped by SkillGate.</li>
          <li>Require signed session artifact verification before promotion/deploy.</li>
          <li>Protect branches so security checks are required before merge.</li>
          <li>Use hardened runtime defaults (`prod`/`strict`) for protected branches.</li>
          <li>Run workloads on controlled runners with approved tool entrypoints.</li>
        </ol>
      </DocsBlock>

      <DocsBlock title="Reference architecture checklist">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            `skillgate run` or `skillgate gateway check` is the only approved path for agent tool execution.
          </li>
          <li>`skillgate dag verify` passes for every protected execution session artifact.</li>
          <li>CI blocks merge if wrapper enforcement checks fail.</li>
          <li>Deploy job requires verified artifact and policy gate status.</li>
          <li>Runtime env vars set from centralized secrets/config management.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="GitHub Actions enforcement example">
        <CodeBlock
          code={`name: agent-security-gate
on: [pull_request]

jobs:
  enforce-wrapper-and-artifacts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install SkillGate
        run: pip install skillgate

      - name: Reject unwrapped agent execution paths
        run: python scripts/quality/check_wrapper_enforcement.py

      - name: Execute agent through SkillGate runtime gate
        run: |
          skillgate run \\
            --env ci \\
            --skill-id approved-safe-skill \\
            --skill-hash "$SKILL_HASH" \\
            --scan-attestation "$SCAN_ATTESTATION" \\
            --artifact .skillgate/runtime/session.json \\
            -- codex exec "review changes"

      - name: Verify signed runtime artifact
        run: skillgate dag verify .skillgate/runtime/session.json`}
        />
      </DocsBlock>

      <DocsBlock title="Quick links">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <Link href="/docs/skillgate/runtime-integrations" className="text-emerald-300 hover:text-emerald-200">
              Runtime Integrations
            </Link>
          </li>
          <li>
            <Link href="/docs/skillgate/commands" className="text-emerald-300 hover:text-emerald-200">
              Commands and Subcommands
            </Link>
          </li>
          <li>
            <Link href="/docs/operations" className="text-emerald-300 hover:text-emerald-200">
              Operations
            </Link>
          </li>
        </ul>
      </DocsBlock>
    </DocsPage>
  );
}
