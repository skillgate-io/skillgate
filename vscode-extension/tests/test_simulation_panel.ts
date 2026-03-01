import { describe, expect, it } from 'vitest';
import type { DecisionRecord } from '../src/types';

describe('simulation response contract', () => {
  it('contains full decision record fields', () => {
    const response: DecisionRecord = {
      invocation_id: 'inv-1',
      decision: 'ALLOW',
      decision_code: 'SG_ALLOW',
      policy_version: '2',
      reason_codes: ['ok'],
      budgets: {},
      evidence: { hash: 'h', signature: 's', key_id: 'k' },
      degraded: false,
      entitlement_version: 'local',
      license_mode: 'normal',
    };
    expect(response.reason_codes.length).toBe(1);
    expect(response.evidence.hash).toBe('h');
  });
});
