import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { DocsPage, DocsBlock, CodeBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'VS Code Extension',
  'SkillGate VS Code extension for teams who want early security feedback in Claude Code and Codex workspaces.',
  '/docs/integrations/vscode-extension',
);

export default function DocsVsCodeExtensionIntegrationPage() {
  return (
    <DocsPage
      title="VS Code Extension"
      summary="Get early safety feedback in your editor while keeping your team workflow fast and consistent."
    >
      <DocsBlock title="What you get">
        <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <Image
            src="/images/skillgate-vscode.svg"
            alt="SkillGate VS Code extension logo"
            width={96}
            height={96}
            className="h-16 w-16"
          />
          <p className="text-sm text-surface-300">
            Uses the same production logo and control-plane model as{' '}
            <a href="https://skillgate.io" className="text-emerald-300 hover:text-emerald-200">
              skillgate.io
            </a>{' '}
            and{' '}
            <a href="https://docs.skillgate.io" className="text-emerald-300 hover:text-emerald-200">
              docs.skillgate.io
            </a>
            .
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Policy linting and capability diff checks while you edit.</li>
            <li>Warnings for risky instruction changes in `CLAUDE.md`, `AGENTS.md`, and memory files.</li>
            <li>A setup panel that helps your team verify CLI, login, and sidecar status.</li>
            <li>A clear status bar view for setup and license state.</li>
          </ul>
        </div>
      </DocsBlock>

      <DocsBlock title="Where it turns on">
        <CodeBlock
          code={`Activation includes:
- CLAUDE.md
- AGENTS.md
- MEMORY.md
- .claude/hooks/**
- .claude/commands/**
- .claude/instructions.md
- .claude/memory/**`}
        />
      </DocsBlock>

      <DocsBlock title="How setup checks work">
        <CodeBlock
          code={`Checks on activation:
1) SkillGate CLI installed
2) Auth session available (skillgate auth login)
3) Sidecar reachable (127.0.0.1:9911)

Behavior:
- Static diagnostics stay active even if runtime/auth is not ready
- Only runtime-dependent actions are gated (simulation, approval workflows)`}
        />
      </DocsBlock>

      <DocsBlock title="Team setup steps">
        <CodeBlock
          code={`# 1) Publish extension
cd vscode-extension
vsce publish

# 2) Team onboarding
skillgate auth login
python -m uvicorn skillgate.sidecar.app:create_sidecar_app --factory --host 127.0.0.1 --port 9911

# 3) Validate in editor
Command Palette -> "SkillGate: Retry Setup Checks"`}
        />
      </DocsBlock>

      <DocsBlock title="Related pages">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <Link href="/docs/integrations/python-sdk" className="text-emerald-300 hover:text-emerald-200">
              Python SDK Integration
            </Link>
          </li>
          <li>
            <Link href="/docs/integrations/claude-code" className="text-emerald-300 hover:text-emerald-200">
              Claude Code Integration
            </Link>
          </li>
          <li>
            <Link href="/docs/runtime-control" className="text-emerald-300 hover:text-emerald-200">
              Runtime Control
            </Link>
          </li>
        </ul>
      </DocsBlock>
    </DocsPage>
  );
}
