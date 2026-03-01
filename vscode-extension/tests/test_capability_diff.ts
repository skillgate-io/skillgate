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
});
