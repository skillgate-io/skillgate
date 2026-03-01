import { LintIssue } from './types';

const ALLOWED_TOP_LEVEL = new Set([
  'version',
  'name',
  'trust_tiers',
  'capability_budgets',
  'rules',
  'approval_requirements',
  'exceptions',
]);

const DEPRECATED_PATTERNS: Array<{ token: string; message: string }> = [
  {
    token: 'allow_all',
    message: 'Deprecated field allow_all detected. Use explicit rules.',
  },
  {
    token: 'net.outbound: "*"',
    message: 'Wildcard outbound capability requires explicit review.',
  },
];

function topLevelKeys(text: string): Array<{ key: string; line: number }> {
  const keys: Array<{ key: string; line: number }> = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/^\s/.test(line)) {
      return;
    }
    const match = line.match(/^([a-zA-Z0-9_\-]+)\s*:/);
    if (match) {
      keys.push({ key: match[1], line: index + 1 });
    }
  });
  return keys;
}

export function lintPolicyDocument(text: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const keys = topLevelKeys(text);

  const hasVersionOne = /^version\s*:\s*["']?1["']?\s*$/m.test(text);
  if (!hasVersionOne) {
    issues.push({
      message: 'Policy schema version must be "1".',
      severity: 'error',
      line: 1,
      source: 'skillgate.policy.version',
    });
  }

  for (const key of keys) {
    if (ALLOWED_TOP_LEVEL.has(key.key)) {
      continue;
    }
    issues.push({
      message: `Unknown policy field: ${key.key}`,
      severity: 'error',
      line: key.line,
      source: 'skillgate.policy.schema',
    });
  }

  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of DEPRECATED_PATTERNS) {
      if (!line.includes(pattern.token)) {
        continue;
      }
      issues.push({
        message: pattern.message,
        severity: 'warning',
        line: index + 1,
        source: 'skillgate.policy.deprecated',
      });
    }
  });

  return issues;
}
