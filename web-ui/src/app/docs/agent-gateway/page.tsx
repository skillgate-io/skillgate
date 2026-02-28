import type { Metadata } from 'next';
import Link from 'next/link';
import { CodeBlock, DocsBlock, DocsPage } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Agent Gateway',
  'Route OpenClaw, Codex, Claude, and other local AI agents through SkillGate safety checks with clear audit evidence.',
  '/docs/agent-gateway',
);

export default function DocsAgentGatewayPage() {
  return (
    <DocsPage
      title="Agent Gateway (`skillgate run`)"
      summary="Use this page to run Codex, Claude, or any CLI agent through SkillGate policy enforcement."
    >
      <DocsBlock title="Security Guarantee Boundary">
        <p>
          SkillGate enforces strong controls when execution goes through `skillgate run` or native
          gateway hooks. To prevent bypass, your organization must also enforce wrapper-only execution
          in CI and deployment policy.
        </p>
        <p>
          See{' '}
          <Link
            href="/docs/skillgate/enforcement-boundaries"
            className="text-emerald-300 hover:text-emerald-200"
          >
            Guarantees and Org Controls
          </Link>{' '}
          for the full checklist.
        </p>
      </DocsBlock>

      <DocsBlock title="When to use this command">
        <ul className="list-disc space-y-2 pl-6">
          <li>Block unsafe runtime commands before execution in `ci`, `prod`, or `strict`.</li>
          <li>Verify invocation identity at runtime (`--skill-id`, `--skill-hash`).</li>
          <li>Detect tool output poisoning (TOP) before output is re-used by an agent.</li>
          <li>Generate signed runtime session artifacts for audit and CI evidence.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Basic usage">
        <CodeBlock
          code={`# Required: pass the wrapped command after --
skillgate run -- codex exec "scan this repository"

# Environment controls blocking policy matrix
skillgate run --env strict -- codex exec "run deploy script"

# Save runtime artifact to a stable location
skillgate run \
  --artifact .skillgate/runtime/session.json \
  -- codex exec "check changes"`}
        />
      </DocsBlock>

      <DocsBlock title="Runtime trust validation">
        <CodeBlock
          code={`# 1) Import a trusted component manifest
skillgate bom import ./bom.cyclonedx.json \
  --output .skillgate/bom/approved.json

# 2) Validate a skill entry directly
skillgate bom validate \
  --mode strict \
  --store .skillgate/bom/approved.json \
  --skill-id approved-safe-skill \
  --skill-hash e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 \
  --scan-attestation valid

# 3) Enforce the same trust checks on runtime execution
skillgate run \
  --env strict \
  --skill-id approved-safe-skill \
  --skill-hash e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 \
  --scan-attestation valid \
  -- codex exec "open README.md"`}
        />
      </DocsBlock>

      <DocsBlock title="TOP guard modes">
        <CodeBlock
          code={`# Default behavior uses env matrix (dev=annotate, strict=block)
skillgate run --env dev -- codex exec "summarize outputs"

# Force specific TOP behavior
skillgate run --top-outcome annotate -- codex exec "review logs"
skillgate run --top-outcome sanitize -- codex exec "review logs"
skillgate run --top-outcome block -- codex exec "review logs"

# Disable TOP guard if needed for debugging
skillgate run --disable-top-guard -- codex exec "debug prompt"`}
        />
      </DocsBlock>

      <DocsBlock title="Troubleshooting">
        <p className="font-semibold text-white">Error: Missing wrapped command. Example: skillgate run -- codex exec "review repo"</p>
        <p>Cause: `skillgate run` requires a wrapped command after `--`.</p>
        <CodeBlock
          code={`# Incorrect
skillgate run

# Correct
skillgate run -- codex exec "check repository"`}
        />

        <p className="font-semibold text-white">Error: stdout is not a terminal</p>
        <p>
          Cause: the wrapped agent command expects an interactive TTY. Use a non-interactive agent mode
          (for example `exec`/batch subcommands) when running through the gateway.
        </p>
        <CodeBlock
          code={`# Prefer non-interactive mode for wrapped execution
skillgate run -- codex exec "review diff"

# In CI, always use explicit non-interactive commands
skillgate run --env ci -- codex exec "run security checks"`}
        />
      </DocsBlock>

      <DocsBlock title="Verify session artifacts">
        <CodeBlock
          code={`# Verify signatures
skillgate dag verify .skillgate/runtime/session.json

# Inspect full decision chain
skillgate dag show .skillgate/runtime/session.json`}
        />
      </DocsBlock>

      <DocsBlock title="Related pages">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <Link href="/docs/cli" className="text-emerald-300 hover:text-emerald-200">
              CLI reference
            </Link>
          </li>
          <li>
            <Link href="/docs/operations" className="text-emerald-300 hover:text-emerald-200">
              Operations runbook
            </Link>
          </li>
        </ul>
      </DocsBlock>
    </DocsPage>
  );
}
