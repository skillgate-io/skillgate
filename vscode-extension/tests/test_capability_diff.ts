import { describe, expect, it } from 'vitest';
import { detectCapabilityDiff } from '../src/capabilityDiff';

describe('capability diff', () => {
  it('no change yields no warnings', () => {
    const base = 'version: "1"\nnet.outbound: "api.example.com"\n';
    const next = 'version: "1"\nnet.outbound: "api.example.com"\n';
    expect(detectCapabilityDiff(base, next)).toEqual([]);
  });

  it('new outbound wildcard is error', () => {
    const base = 'version: "1"\n';
    const next = 'version: "1"\nnet.outbound: "*"\n';
    const changes = detectCapabilityDiff(base, next);
    expect(changes[0]?.severity).toBe('error');
  });

  it('removed capability is informational', () => {
    const base = 'version: "1"\nfs.write: "repo/**"\n';
    const next = 'version: "1"\n';
    const changes = detectCapabilityDiff(base, next);
    expect(changes[0]?.change).toBe('removed');
    expect(changes[0]?.severity).toBe('info');
  });

  it('detects capability changes in permissions-based policy files', () => {
    const base = 'version: "1"\npermissions:\n  allow_shell: false\n  allow_network: false\n';
    const next =
      'version: "1"\npermissions:\n  allow_shell: true\n  allow_network: true\n  allowed_domains: []\n';
    const changes = detectCapabilityDiff(base, next);
    expect(changes.some((item) => item.capability === 'shell.exec')).toBe(true);
    expect(changes.some((item) => item.capability === 'net.outbound')).toBe(true);
  });
});
