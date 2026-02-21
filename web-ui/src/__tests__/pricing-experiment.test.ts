import { beforeEach, describe, expect, it } from 'vitest';
import { resolvePricingExperimentAssignment } from '@/lib/pricing-experiment';

describe('pricing experiment assignment', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('honors query override and persists variant', () => {
    const assignment = resolvePricingExperimentAssignment(
      '?pricing_variant=feature-led',
      window.localStorage,
    );

    expect(assignment.variant).toBe('feature-led');
    expect(assignment.source).toBe('query');
    expect(window.localStorage.getItem('sg_pricing_variant')).toBe('feature-led');
    expect(window.localStorage.getItem('sg_pricing_seed')).toBeTruthy();
  });

  it('uses stored variant when present', () => {
    window.localStorage.setItem('sg_pricing_variant', 'control-layer-led');
    window.localStorage.setItem('sg_pricing_seed', 'stable-seed-1');

    const assignment = resolvePricingExperimentAssignment('', window.localStorage);

    expect(assignment.variant).toBe('control-layer-led');
    expect(assignment.source).toBe('storage');
    expect(assignment.seed).toBe('stable-seed-1');
  });

  it('assigns deterministically from seed', () => {
    window.localStorage.setItem('sg_pricing_seed', 'deterministic-seed');

    const first = resolvePricingExperimentAssignment('', window.localStorage);
    const second = resolvePricingExperimentAssignment('', window.localStorage);

    expect(first.source).toBe('deterministic');
    expect(second.source).toBe('storage');
    expect(first.variant).toBe(second.variant);
  });
});
