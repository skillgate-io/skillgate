export type Severity = 'info' | 'warning' | 'error';

export interface LintIssue {
  message: string;
  severity: Severity;
  line: number;
  source: string;
}

export interface CapabilityChange {
  capability: string;
  change: 'added' | 'removed';
  severity: Severity;
  message: string;
}

export interface RiskHint {
  line: number;
  code: string;
  message: string;
  severity: Severity;
  remediation: string;
}

export interface InstructionWarning {
  line: number;
  category: 'jailbreak' | 'capability-override' | 'exfiltration';
  message: string;
  snippet: string;
}

export interface LicenseState {
  mode: 'licensed' | 'limited' | 'needs-login';
  tier: string;
}

export interface DecisionRecord {
  invocation_id: string;
  decision: string;
  decision_code: string;
  policy_version: string;
  reason_codes: string[];
  budgets: Record<string, { remaining: number; limit: number }>;
  evidence: { hash: string; signature: string; key_id: string };
  degraded: boolean;
  entitlement_version: string;
  license_mode: string;
}

export interface ApprovalRequestRecord {
  approval_id: string;
  status: string;
  decision_code: string;
  invocation_id: string;
  reasons: string[];
  created_at: string;
  path: string;
  skill_id?: string;
  skill_hash?: string;
  env?: string;
  reviewers?: string[];
  approval_file?: string;
  signed_at?: string;
  verified_at?: string;
  verify_code?: string;
  verify_reason?: string;
}

export interface GuidedFlowStep {
  id: 'init-policy' | 'simulate' | 'checklist' | 'approval-center';
  label: string;
  done: boolean;
  command: string;
}

export interface GuidedFlowState {
  steps: GuidedFlowStep[];
  nextActionCommand?: string;
  nextActionLabel?: string;
  completed: boolean;
}

export interface PreflightState {
  cliInstalled: boolean;
  authenticated: boolean;
  sidecarRunning: boolean;
  authSummary?: string;
  sidecarUrl?: string;
  guided?: GuidedFlowState;
  nextStep: 'install-cli' | 'login' | 'start-sidecar' | 'ready';
  cliInstallHint: string;
  checkedAt: string;
}
