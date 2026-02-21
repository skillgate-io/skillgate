/* Pricing module unit tests */
import { describe, it, expect } from 'vitest';
import {
  COMPARISON_ROWS,
  CONTROL_STACK_LAYERS,
  PRICING_TIERS,
  formatPrice,
} from '@/lib/pricing';

describe('pricing', () => {
  it('has exactly 4 tiers', () => {
    expect(PRICING_TIERS).toHaveLength(4);
  });

  it('includes all tier IDs', () => {
    const ids = PRICING_TIERS.map((t) => t.id);
    expect(ids).toEqual(['free', 'pro', 'team', 'enterprise']);
  });

  it('only highlights one tier (Pro)', () => {
    const highlighted = PRICING_TIERS.filter((t) => t.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]?.id).toBe('pro');
  });

  it('free tier has no price', () => {
    const free = PRICING_TIERS.find((t) => t.id === 'free');
    expect(free?.monthlyPrice).toBe(0);
    expect(free?.yearlyPrice).toBe(0);
    expect(free ? formatPrice(free, 'monthly') : '').toBe('$0');
    expect(free ? formatPrice(free, 'yearly') : '').toBe('$0');
  });

  it('all tiers have features', () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.features.length).toBeGreaterThan(0);
      expect(tier.name).toBeTruthy();
      expect(tier.cta).toBeTruthy();
      expect(tier.narrative).toBeTruthy();
      expect(tier.controlLayerSummary).toBeTruthy();
      expect(tier.stackCoverage.length).toBeGreaterThan(0);
    }
  });

  it('enterprise has no limits listed', () => {
    const enterprise = PRICING_TIERS.find((t) => t.id === 'enterprise');
    expect(enterprise?.limits).toHaveLength(0);
    expect(enterprise ? formatPrice(enterprise, 'yearly') : '').toBe('Custom');
  });

  it('team explicitly includes fleet coverage controls', () => {
    const team = PRICING_TIERS.find((t) => t.id === 'team');
    expect(team?.features.some((feature) => /fleet-wide scanning/i.test(feature))).toBe(true);
  });

  it('enterprise is positioned as control plane infrastructure', () => {
    const enterprise = PRICING_TIERS.find((t) => t.id === 'enterprise');
    expect(enterprise?.strategicLabel).toBe('AI Agent Control Plane');
    expect(enterprise?.features.some((feature) => /runtime capability budgets/i.test(feature))).toBe(
      true,
    );
    expect(
      enterprise?.features.some((feature) => /transitive risk.*trust propagation/i.test(feature)),
    ).toBe(true);
  });

  it('defines control stack layers in order', () => {
    expect(CONTROL_STACK_LAYERS.map((layer) => layer.id)).toEqual([
      'static_scan',
      'policy_engine',
      'ci_enforcement',
      'runtime_gateway',
      'capability_budgets',
      'trust_propagation',
      'intelligence_graph',
    ]);
  });

  it('comparison matrix includes governance categories and enterprise runtime anchors', () => {
    expect(COMPARISON_ROWS.some((row) => row.category === 'Static Governance')).toBe(true);
    expect(COMPARISON_ROWS.some((row) => row.category === 'CI & Fleet Governance')).toBe(true);
    expect(COMPARISON_ROWS.some((row) => row.category === 'Runtime & Org Control Plane')).toBe(true);
    expect(COMPARISON_ROWS.some((row) => row.category === 'Compliance & Evidence')).toBe(true);
    expect(COMPARISON_ROWS.some((row) => /Runtime capability budgets/.test(row.capability))).toBe(
      true,
    );
    expect(COMPARISON_ROWS.some((row) => /transitive risk/i.test(row.capability))).toBe(true);
  });

  it('pricing claims remain aligned to enforceable tier progression', () => {
    const tiersById = Object.fromEntries(PRICING_TIERS.map((tier) => [tier.id, tier]));
    const free = tiersById.free;
    const pro = tiersById.pro;
    const team = tiersById.team;
    const enterprise = tiersById.enterprise;

    expect(free?.stackCoverage).toEqual(['static_scan']);
    expect(pro?.stackCoverage).toEqual(['static_scan', 'policy_engine']);
    expect(team?.stackCoverage).toEqual(['static_scan', 'policy_engine', 'ci_enforcement']);
    expect(enterprise?.stackCoverage).toEqual([
      'static_scan',
      'policy_engine',
      'ci_enforcement',
      'runtime_gateway',
      'capability_budgets',
      'trust_propagation',
      'intelligence_graph',
    ]);
  });
});
