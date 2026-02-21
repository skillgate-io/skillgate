import type { Metadata } from 'next';
import { CodeBlock, DocsBlock, DocsPage } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'SkillGate Commands and Subcommands',
  'Complete SkillGate CLI command tree with examples.',
  '/docs/skillgate/commands',
);

const commandTree = `skillgate
├── scan
├── simulate
├── run
├── verify
├── init
├── hunt
├── retroscan
├── rules
├── auth
├── approval
│   ├── sign
│   └── verify
├── gateway
│   ├── check
│   └── scan-output
├── keys
│   └── generate
├── hooks
│   ├── install
│   └── uninstall
├── bom
│   ├── import
│   └── validate
├── drift
│   ├── baseline
│   └── check
├── reputation
│   ├── verify
│   ├── check
│   └── submit
└── dag
    ├── show
    ├── verify
    └── risk`;

export default function DocsSkillGateCommandsPage() {
  return (
    <DocsPage
      title="Commands and Subcommands"
      summary="Use this page as the complete command reference for the SkillGate CLI."
    >
      <DocsBlock title="Command tree">
        <CodeBlock code={commandTree} />
      </DocsBlock>

      <DocsBlock title="Essential examples">
        <CodeBlock
          code={`# Initialize policy
skillgate init --preset production

# Scan and enforce
skillgate scan ./my-agent-skill --policy production --enforce

# Fleet checks
skillgate scan ./agents --fleet --fail-on-threshold 10 --output json

# Org-scale simulation
skillgate simulate --org "github:acme/*" --policy strict --output json

# Runtime gateway
skillgate run --env ci -- codex exec "review changed files"
skillgate gateway check --env prod --tool-class shell --target "bash -lc id"

# Verify signed scan report
skillgate verify report.json

# Approval workflow
skillgate approval sign --skill-id my-skill --skill-hash <sha256> --reviewer sec-a --reviewer sec-b
skillgate approval verify .skillgate/approvals/approval.json --required-reviewers 2

# Import BOM and validate a skill
skillgate bom import ./bom.cyclonedx.json
skillgate bom validate --mode strict --skill-id approved-safe-skill --skill-hash <sha256> --scan-attestation valid

# Drift and reputation
skillgate drift baseline ./agents --fleet
skillgate drift check ./agents --fleet --fail-on-drift
skillgate reputation check --bundle-hash <sha256> --env prod

# Verify runtime session artifact
skillgate dag verify .skillgate/runtime/session.json
skillgate dag risk .skillgate/runtime/session.json --output json`}
        />
      </DocsBlock>

      <DocsBlock title="Exit codes">
        <CodeBlock
          code={`0  success
1  policy violation or blocked runtime action
2  internal error
3  invalid input`}
        />
      </DocsBlock>
    </DocsPage>
  );
}
