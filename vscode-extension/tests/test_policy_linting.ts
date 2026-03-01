import { describe, expect, it } from 'vitest';
import { lintPolicyDocument } from '../src/policyLint';

describe('policy linting', () => {
  it('accepts valid policy', () => {
    const issues = lintPolicyDocument('version: "1"\nname: "prod"\nrules: []\n');
    expect(issues.length).toBe(0);
  });

  it('flags unknown field and version mismatch', () => {
    const issues = lintPolicyDocument('version: "2"\nunknown_field: true\n');
    expect(issues.some((item) => item.message.includes('Unknown policy field'))).toBe(true);
    expect(issues.some((item) => item.message.includes('version'))).toBe(true);
  });

  it('flags deprecated wildcard pattern', () => {
    const issues = lintPolicyDocument('version: "1"\nnet.outbound: "*"\n');
    expect(issues.some((item) => item.severity === 'warning')).toBe(true);
  });
});
