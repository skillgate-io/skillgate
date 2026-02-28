import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsPage, DocsBlock, CodeBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Python SDK Integration',
  'SkillGate Python SDK guide for teams that want safer tool calls in production apps.',
  '/docs/integrations/python-sdk',
);

export default function DocsPythonSdkIntegrationPage() {
  return (
    <DocsPage
      title="Python SDK Integration"
      summary="Protect tool actions in your app before execution and keep behavior consistent across environments."
    >
      <DocsBlock title="Install and activate">
        <CodeBlock
          code={`pip install skillgate-sdk
export SKILLGATE_SLT="<session-license-token>"
export SKILLGATE_SIDECAR_URL="http://127.0.0.1:9911"`}
        />
      </DocsBlock>

      <DocsBlock title="How it protects your tools">
        <CodeBlock
          code={`from skillgate.sdk import enforce

@enforce(capabilities=["fs.read"], package_version="1.0.0")
def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as handle:
        return handle.read()`}
        />
        <p>If a call is denied, the SDK blocks it and returns a clear, actionable error.</p>
      </DocsBlock>

      <DocsBlock title="Onboarding and preflight in app teams">
        <CodeBlock
          code={`Preflight checklist:
1) CLI installed and sidecar running
2) SKILLGATE_SLT present
3) policy + entitlements loaded

Production mode:
- fail_closed (default) for high-assurance systems
- fail_open only for explicitly approved degraded paths`}
        />
      </DocsBlock>

      <DocsBlock title="Audit and governance support">
        <CodeBlock
          code={`Runtime behavior:
- Registers tool metadata to /v1/registry/{tool_name}
- Persists integration-manifest entries
- Re-registers on version change or failed prior registration`}
        />
      </DocsBlock>

      <DocsBlock title="Framework adapters">
        <ul className="list-disc space-y-2 pl-6">
          <li>PydanticAI wrappers for tool enforcement in agent workflows.</li>
          <li>LangChain `BaseTool` compatible wrappers for policy-enforced tools.</li>
          <li>CrewAI task wrappers for delegated execution controls.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Related pages">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <Link href="/docs/integrations/vscode-extension" className="text-emerald-300 hover:text-emerald-200">
              VS Code Extension
            </Link>
          </li>
          <li>
            <Link href="/docs/agent-gateway" className="text-emerald-300 hover:text-emerald-200">
              Agent Gateway
            </Link>
          </li>
          <li>
            <Link href="/docs/enterprise/security" className="text-emerald-300 hover:text-emerald-200">
              Enterprise Security
            </Link>
          </li>
        </ul>
      </DocsBlock>
    </DocsPage>
  );
}
