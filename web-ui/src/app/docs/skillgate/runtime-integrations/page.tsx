import type { Metadata } from 'next';
import Link from 'next/link';
import { CodeBlock, DocsBlock, DocsPage } from '@/components/docs/DocsPage';
import { IntegrationTabs } from '@/components/docs/IntegrationTabs';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'SkillGate Runtime Integrations',
  'Run Claude Code and Codex through SkillGate runtime checks with MCP and CI safety controls.',
  '/docs/skillgate/runtime-integrations',
);

const examples = [
  {
    id: 'codex',
    label: 'Codex',
    summary: 'Non-interactive Codex execution through SkillGate runtime gateway.',
    commands: `skillgate run --env ci -- codex exec "review this PR"
skillgate run --env strict --artifact .skillgate/runtime/codex.json -- codex exec "run secure refactor"
skillgate dag verify .skillgate/runtime/codex.json`,
    notes: [
      'Use non-interactive subcommands like `exec` to avoid terminal errors.',
      'Use `--env strict` for production workflows that require blocking.',
    ],
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    summary: 'Runtime wrapping for Claude Code in CI and local review flows.',
    commands: `skillgate run --env dev -- claude -p "summarize security risks in this repo"
skillgate run --env ci --skill-id approved-safe-skill --skill-hash <sha256> --scan-attestation valid -- claude -p "review deployment diff"`,
    notes: [
      'Provide `--skill-id`, `--skill-hash`, and `--scan-attestation` to enforce strict trust checks.',
      'Set `--top-outcome sanitize` when you want suspicious outputs redacted instead of blocked.',
    ],
  },
] as const;

export default function DocsRuntimeIntegrationsPage() {
  return (
    <DocsPage
      title="Runtime Integrations"
      summary="Use these integration patterns for Claude Code, Codex CLI, and MCP tool governance."
    >
      <DocsBlock title="Security Guarantee Boundary">
        <p>
          SkillGate guarantees runtime controls only when the agent call is routed through SkillGate
          (`skillgate run` or `gateway check`). Direct unwrapped execution must be blocked by CI and
          platform policy.
        </p>
        <p>
          Use the{' '}
          <Link
            href="/docs/skillgate/enforcement-boundaries"
            className="text-emerald-300 hover:text-emerald-200"
          >
            Guarantees and Org Controls
          </Link>{' '}
          checklist for bypass-resistant rollout.
        </p>
      </DocsBlock>

      <DocsBlock title="Integration examples">
        <div className="mb-4 flex flex-wrap gap-2 text-xs text-surface-300">
          {['Claude Code', 'Codex CLI', 'MCP Gateway'].map((label) => (
            <span key={label} className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1">
              {label}
            </span>
          ))}
        </div>
        <IntegrationTabs examples={[...examples]} />
      </DocsBlock>

      <DocsBlock title="Adapter pseudocode (Codex and Claude hooks)">
        <p>Use this pattern when integrating native hooks with `skillgate gateway check` and `scan-output`.</p>
        <CodeBlock
          code={`# Codex hook adapter pseudocode
def before_codex_tool_call(tool_command: str) -> dict:
    check = run_json([
        "skillgate", "gateway", "check",
        "--env", "ci",
        "--command", tool_command,
        "--skill-id", skill_id,
        "--skill-hash", skill_hash,
        "--scan-attestation", scan_attestation,
    ])
    if not check["allowed"]:
        raise Blocked(check["code"], check["reason"])
    return check

def after_codex_tool_call(tool_output: str) -> str:
    scan = run_json([
        "skillgate", "gateway", "scan-output",
        "--env", "ci",
        "--output-text", tool_output,
    ])
    if scan["outcome"] == "BLOCK":
        raise Blocked("SG-TOP-001", "Output quarantined")
    return tool_output if scan["outcome"] != "SANITIZE" else "[sanitized output]"`}
        />
        <CodeBlock
          code={`// Claude hook adapter pseudocode
async function gateAndRunClaudeTool(plannedCommand, executeClaudeTool) {
  const check = await runJson([
    "skillgate", "gateway", "check",
    "--env", "prod",
    "--command", plannedCommand
  ]);
  if (!check.allowed) throw new Error(\`\\\${check.code}: \\\${check.reason}\`);

  const rawOutput = await executeClaudeTool({
    command: plannedCommand,
    metadata: { skillgateScopeToken: check.scope_token }
  });

  const scan = await runJson([
    "skillgate", "gateway", "scan-output",
    "--env", "prod",
    "--output-text", rawOutput
  ]);
  if (scan.outcome === "BLOCK") throw new Error("SG-TOP-001: output quarantined");
  if (scan.outcome === "SANITIZE") return "[sanitized output]";
  return rawOutput;
}`}
        />
        <p>
          For bypass-resistant deployment requirements and CI policy gates, see{' '}
          <Link
            href="/docs/skillgate/enforcement-boundaries"
            className="text-emerald-300 hover:text-emerald-200"
          >
            Guarantees and Org Controls
          </Link>
          .
        </p>
      </DocsBlock>
    </DocsPage>
  );
}
