import { RiskHint } from './types';

const RULES: Array<{ code: string; regex: RegExp; message: string; remediation: string; severity: 'warning' | 'error' }> = [
  {
    code: 'SG-SHELL-004',
    regex: /shell\s*=\s*True|os\.system\(|exec\(|child_process\.exec\(/,
    message: 'Potential shell execution risk.',
    remediation: 'Use argument arrays and avoid shell expansion.',
    severity: 'error',
  },
  {
    code: 'SG-NET-001',
    regex: /fetch\(|httpx\.|requests\.|curl\s+https?:\/\//,
    message: 'Outbound network call detected.',
    remediation: 'Verify destination allowlist and policy scope.',
    severity: 'warning',
  },
  {
    code: 'SG-EVAL-001',
    regex: /\beval\(|Function\(|exec\(/,
    message: 'Dynamic code execution pattern detected.',
    remediation: 'Replace dynamic execution with explicit logic.',
    severity: 'error',
  },
];

export function detectInlineRiskHints(text: string): RiskHint[] {
  const hints: RiskHint[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const rule of RULES) {
      if (!rule.regex.test(line)) {
        continue;
      }
      hints.push({
        line: index + 1,
        code: rule.code,
        message: rule.message,
        severity: rule.severity,
        remediation: rule.remediation,
      });
    }
  });

  return hints;
}
