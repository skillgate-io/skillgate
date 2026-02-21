/* Pricing tier definitions — local fallback.
 *
 * Primary source of truth is backend `/api/v1/pricing/catalog`.
 * This module remains as resilient fallback when API data is unavailable.
 */

export type BillingInterval = 'monthly' | 'yearly';
export type PlanAvailability = 'yes' | 'partial' | 'no';
export type ControlStackLayerId =
  | 'static_scan'
  | 'policy_engine'
  | 'ci_enforcement'
  | 'runtime_gateway'
  | 'capability_budgets'
  | 'trust_propagation'
  | 'intelligence_graph';

export interface PricingTier {
  id: 'free' | 'pro' | 'team' | 'enterprise';
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  period: string;
  description: string;
  cta: string;
  ctaVariant: 'outline' | 'primary';
  highlighted: boolean;
  strategicLabel?: string;
  annualContractOnly?: boolean;
  narrative: string;
  controlLayerSummary: string;
  stackCoverage: ControlStackLayerId[];
  features: string[];
  limits: string[];
}

export interface ControlStackLayer {
  id: ControlStackLayerId;
  title: string;
  description: string;
}

export interface ComparisonRow {
  id: string;
  category:
    | 'Static Governance'
    | 'CI & Fleet Governance'
    | 'Runtime & Org Control Plane'
    | 'Compliance & Evidence';
  capability: string;
  free: PlanAvailability;
  pro: PlanAvailability;
  team: PlanAvailability;
  enterprise: PlanAvailability;
}

export const CONTROL_STACK_LAYERS: ControlStackLayer[] = [
  {
    id: 'static_scan',
    title: 'Static Scan',
    description: 'Deterministic risk detection across skills, code, and docs artifacts.',
  },
  {
    id: 'policy_engine',
    title: 'Policy Engine',
    description: 'Policy-as-code thresholds with explicit enforcement gates.',
  },
  {
    id: 'ci_enforcement',
    title: 'CI Enforcement',
    description: 'PR blocking and low-noise annotations in CI pipelines.',
  },
  {
    id: 'runtime_gateway',
    title: 'Runtime Gateway',
    description: 'Pre-execution controls for agent tool invocations.',
  },
  {
    id: 'capability_budgets',
    title: 'Capability Budgets',
    description: 'Hard budgets for shell, network, filesystem, and external domain use.',
  },
  {
    id: 'trust_propagation',
    title: 'Trust Propagation',
    description: 'Signed lineage DAG and transitive privilege/risk modeling.',
  },
  {
    id: 'intelligence_graph',
    title: 'Intelligence Graph',
    description: 'Signed reputation graph integration with org-level risk context.',
  },
];

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    id: 'static-baseline',
    category: 'Static Governance',
    capability: 'Static governance baseline scans',
    free: 'yes',
    pro: 'yes',
    team: 'yes',
    enterprise: 'yes',
  },
  {
    id: 'policy-customization',
    category: 'Static Governance',
    capability: 'Policy-as-code customization',
    free: 'no',
    pro: 'yes',
    team: 'yes',
    enterprise: 'yes',
  },
  {
    id: 'signed-attestations',
    category: 'Static Governance',
    capability: 'Signed attestations and verification',
    free: 'no',
    pro: 'yes',
    team: 'yes',
    enterprise: 'yes',
  },
  {
    id: 'fleet-scan',
    category: 'CI & Fleet Governance',
    capability: 'Fleet-wide scanning across multiple skills and repositories',
    free: 'no',
    pro: 'no',
    team: 'yes',
    enterprise: 'yes',
  },
  {
    id: 'ci-pr-blocking',
    category: 'CI & Fleet Governance',
    capability: 'CI/CD PR blocking and deterministic annotations',
    free: 'no',
    pro: 'no',
    team: 'yes',
    enterprise: 'yes',
  },
  {
    id: 'org-risk-posture',
    category: 'CI & Fleet Governance',
    capability: 'Org risk posture summaries and drift controls',
    free: 'no',
    pro: 'no',
    team: 'yes',
    enterprise: 'yes',
  },
  {
    id: 'runtime-capability-budgets',
    category: 'Runtime & Org Control Plane',
    capability: 'Runtime capability budgets',
    free: 'no',
    pro: 'no',
    team: 'no',
    enterprise: 'yes',
  },
  {
    id: 'transitive-risk-graph',
    category: 'Runtime & Org Control Plane',
    capability: 'Transitive risk and trust propagation graph',
    free: 'no',
    pro: 'no',
    team: 'no',
    enterprise: 'yes',
  },
  {
    id: 'policy-simulation',
    category: 'Runtime & Org Control Plane',
    capability: 'Org-scale policy simulation and rollout modeling',
    free: 'no',
    pro: 'no',
    team: 'yes',
    enterprise: 'yes',
  },
  {
    id: 'airgap-private-relay',
    category: 'Runtime & Org Control Plane',
    capability: 'Private relay and air-gapped enforcement modes',
    free: 'no',
    pro: 'no',
    team: 'no',
    enterprise: 'yes',
  },
  {
    id: 'governance-api-audit',
    category: 'Runtime & Org Control Plane',
    capability: 'Audit export bundles and control-mapping evidence workflows',
    free: 'no',
    pro: 'no',
    team: 'no',
    enterprise: 'yes',
  },
  {
    id: 'compliance-control-mapping',
    category: 'Compliance & Evidence',
    capability: 'Control mapping evidence packages (EU AI Act, SOC 2, internal controls)',
    free: 'no',
    pro: 'no',
    team: 'partial',
    enterprise: 'yes',
  },
  {
    id: 'signed-decision-logs',
    category: 'Compliance & Evidence',
    capability: 'Signed governance decision logs and provenance export support',
    free: 'no',
    pro: 'no',
    team: 'partial',
    enterprise: 'yes',
  },
];

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    period: 'forever',
    description: 'Run your first security scans for agent skills.',
    narrative: 'Developer visibility',
    controlLayerSummary: 'Static Governance',
    stackCoverage: ['static_scan'],
    cta: 'Get Started Free',
    ctaVariant: 'outline',
    highlighted: false,
    features: [
      '3 scans per day',
      'Baseline risk scoring',
      'Top 5 findings per scan',
      'Python, JS, TS, Shell analysis',
      'CLI output (human-readable)',
    ],
    limits: [
      'No policy enforcement',
      'No signed attestations',
      'No CI/CD integration',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 49,
    yearlyPrice: 490, // ~17% discount (2 months free): $49 × 10 = $490/year vs $588/year
    period: '/month',
    description: 'Full static policy controls for individual developers and freelancers.',
    narrative: 'Full static governance',
    controlLayerSummary: 'Static Governance + Policy Engine',
    stackCoverage: ['static_scan', 'policy_engine'],
    cta: 'Start Pro',
    ctaVariant: 'primary',
    highlighted: true,
    features: [
      'Unlimited scans',
      'All 7 languages (+ Go, Rust, Ruby)',
      '119 detection rules',
      'Markdown and multi-artifact detection',
      'Full risk scoring with severity + confidence breakdown',
      'Policy customization (YAML)',
      'Ed25519 signed attestation reports',
      'Capability modeling and simulation',
      'JSON + SARIF output formats',
      'Email support',
    ],
    limits: [
      'No CI/CD PR blocking',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    monthlyPrice: 99,
    yearlyPrice: 990, // ~17% discount (2 months free): $99 × 10 = $990/year vs $1188/year
    period: '/month',
    description: 'CI enforcement and fleet controls for engineering teams.',
    narrative: 'Engineering team governance',
    controlLayerSummary: 'Static + Policy + CI + Fleet Governance',
    stackCoverage: ['static_scan', 'policy_engine', 'ci_enforcement'],
    cta: 'Start Team',
    ctaVariant: 'primary',
    highlighted: false,
    features: [
      'Everything in Pro',
      'Fleet-wide scanning controls',
      'Multi-skill summaries with deterministic outputs',
      'GitHub Action PR blocking',
      'GitLab CI / Bitbucket Pipelines',
      'Low-noise deterministic PR annotations',
      'SARIF upload to GitHub Security tab',
      'Org policy presets and drift detection',
      'Central team dashboard',
      'Slack/webhook alerts',
      'Org risk posture summary',
      'Up to 15 seats',
      'Priority support',
    ],
    limits: [
      'No dedicated signing keys',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 0,
    yearlyPrice: 10000,
    period: '/year',
    description: 'Runtime security control plane for regulated enterprise execution.',
    strategicLabel: 'AI Agent Control Plane',
    annualContractOnly: true,
    narrative: 'Foundational security infrastructure',
    controlLayerSummary: 'Full Control Stack',
    stackCoverage: [
      'static_scan',
      'policy_engine',
      'ci_enforcement',
      'runtime_gateway',
      'capability_budgets',
      'trust_propagation',
      'intelligence_graph',
    ],
    cta: 'Contact Sales',
    ctaVariant: 'outline',
    highlighted: false,
    features: [
      'Everything in Team + regulated runtime controls',
      'Runtime capability budgets',
      'Transitive risk & trust propagation graph',
      'Signed AI-BOM with cryptographic provenance',
      'Org-wide policy simulation and rollout planning',
      'Private relay and air-gapped deployment modes',
      'Signed reputation graph integration',
      'Authoritative entitlement APIs and signed decision logs',
      'Audit-grade export bundles',
      'Control-mapping evidence (EU AI Act, SOC 2, internal controls)',
      'Unlimited seats',
      'On-prem and hybrid entitlement enforcement',
      'Dedicated support engineer',
      'Custom SLAs',
    ],
    limits: [],
  },
];

/**
 * Format price for display with billing interval.
 * Task 17.41: Single source of truth for price display.
 */
export function formatPrice(tier: PricingTier, interval: BillingInterval): string {
  if (tier.id === 'free') return '$0';
  if (tier.id === 'enterprise') return 'Custom';
  
  const price = interval === 'yearly' ? tier.yearlyPrice : tier.monthlyPrice;
  const displayPrice = interval === 'yearly' ? Math.round(price / 12) : price;
  
  return `$${displayPrice}`;
}

/**
 * Calculate savings percentage for yearly billing.
 */
export function calculateSavings(tier: PricingTier): number {
  if (tier.id === 'free' || tier.id === 'enterprise') return 0;
  
  const monthlyCost = tier.monthlyPrice * 12;
  const yearlyCost = tier.yearlyPrice;
  
  return Math.round(((monthlyCost - yearlyCost) / monthlyCost) * 100);
}
