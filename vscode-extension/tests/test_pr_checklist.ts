import { describe, expect, it } from 'vitest';
import { buildPrChecklist } from '../src/prChecklist';

describe('pr checklist', () => {
  it('minimal checklist when no changes', () => {
    const markdown = buildPrChecklist([]);
    expect(markdown).toContain('No capability changes detected');
  });

  it('adds security review when outbound changes', () => {
    const markdown = buildPrChecklist([
      {
        capability: 'net.outbound',
        change: 'added',
        severity: 'error',
        message: 'Capability added: net.outbound',
      },
    ]);
    expect(markdown).toContain('Outbound network expansion reviewed by security lead');
  });
});
