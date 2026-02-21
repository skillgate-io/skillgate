export type DocsNavItem = {
  href: string;
  title: string;
  summary: string;
  section:
    | 'Core'
    | 'SkillGate Platform'
    | 'Reference'
    | 'Security and Legal'
    | 'Enterprise'
    | 'Operations'
    | 'Control Plane';
};

export const DOCS_NAV: DocsNavItem[] = [
  {
    href: '/docs/get-started',
    title: 'Get Started',
    summary: 'Install, run the first scan, enforce policy, and sign the report.',
    section: 'Core',
  },
  {
    href: '/docs/product',
    title: 'Product',
    summary: 'How parse, analyze, score, enforce, and signing modules fit together.',
    section: 'Core',
  },
  {
    href: '/docs/skillgate',
    title: 'SkillGate Tool',
    summary: 'Dedicated docs for commands, subcommands, config, and runtime workflows.',
    section: 'SkillGate Platform',
  },
  {
    href: '/docs/governance',
    title: 'Governance',
    summary: 'Fleet policy, drift checks, and org rollout workflows.',
    section: 'Control Plane',
  },
  {
    href: '/docs/runtime-control',
    title: 'Runtime Control',
    summary: 'Gateway checks, capability budgets, approvals, and lineage enforcement at run time.',
    section: 'Control Plane',
  },
  {
    href: '/docs/intelligence',
    title: 'Intelligence',
    summary: 'Reputation graph, finding enrichment, and signed intelligence contracts.',
    section: 'Control Plane',
  },
  {
    href: '/docs/skillgate/commands',
    title: 'Commands and Subcommands',
    summary: 'Complete command map with practical examples.',
    section: 'SkillGate Platform',
  },
  {
    href: '/docs/skillgate/runtime-integrations',
    title: 'Runtime Integrations',
    summary: 'Codex, Claude Code, Cursor, and Copilot CLI runtime examples.',
    section: 'SkillGate Platform',
  },
  {
    href: '/docs/skillgate/configuration',
    title: 'Configuration',
    summary: 'Policy files, runtime modes, and environment defaults.',
    section: 'SkillGate Platform',
  },
  {
    href: '/docs/skillgate/enforcement-boundaries',
    title: 'Guarantees and Org Controls',
    summary: 'What SkillGate guarantees vs what CI/platform policy must enforce.',
    section: 'SkillGate Platform',
  },
  {
    href: '/docs/cli',
    title: 'CLI',
    summary: 'Command reference and real command examples.',
    section: 'Reference',
  },
  {
    href: '/docs/agent-gateway',
    title: 'Agent Gateway',
    summary: 'How to use `skillgate run` for runtime enforcement and troubleshooting.',
    section: 'Reference',
  },
  {
    href: '/docs/api',
    title: 'API',
    summary: 'Hosted API endpoints, auth, and request contracts.',
    section: 'Reference',
  },
  {
    href: '/docs/integrations',
    title: 'Integrations',
    summary: 'GitHub, GitLab, webhook, and alert setup.',
    section: 'Reference',
  },
  {
    href: '/docs/artifacts',
    title: 'Artifact Coverage',
    summary: 'Markdown, config, and document/archive coverage with provenance behavior.',
    section: 'Reference',
  },
  {
    href: '/docs/security',
    title: 'Security',
    summary: 'Threat model, hardening defaults, and disclosure process.',
    section: 'Security and Legal',
  },
  {
    href: '/docs/legal',
    title: 'Legal',
    summary: 'Legal resources for customer review and compliance checks.',
    section: 'Security and Legal',
  },
  {
    href: '/docs/operations',
    title: 'Operations',
    summary: 'Production reliability checklist for operators and on-call owners.',
    section: 'Operations',
  },
  {
    href: '/docs/migrations',
    title: 'Migrations',
    summary: 'Self-hosted upgrade and rollback guidance.',
    section: 'Operations',
  },
  {
    href: '/docs/enterprise',
    title: 'Enterprise',
    summary: 'Enterprise hub for security, compliance, deployment, and procurement.',
    section: 'Enterprise',
  },
  {
    href: '/docs/enterprise/security',
    title: 'Enterprise Security',
    summary: 'Threat model, controls, and security review package.',
    section: 'Enterprise',
  },
  {
    href: '/docs/enterprise/compliance',
    title: 'Enterprise Compliance',
    summary: 'EU AI Act coverage, AI-BOM evidence, and audit workflows.',
    section: 'Enterprise',
  },
  {
    href: '/docs/enterprise/deployment',
    title: 'Enterprise Deployment',
    summary: 'SaaS, private relay, air-gap, and rollout patterns.',
    section: 'Enterprise',
  },
  {
    href: '/docs/enterprise/procurement',
    title: 'Enterprise Procurement',
    summary: 'Commercial review checklist and onboarding path.',
    section: 'Enterprise',
  },
];

export const DOCS_SECTIONS: Array<DocsNavItem['section']> = [
  'Control Plane',
  'SkillGate Platform',
  'Core',
  'Reference',
  'Security and Legal',
  'Enterprise',
  'Operations',
];
