import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PricingSection } from '@/components/sections/PricingSection';
import { getPricingCatalog } from '@/lib/api-client';

const pushMock = vi.fn();
const trackEventMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({
    isAuthenticated: false,
  }),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
}));

vi.mock('@/lib/api-client', () => ({
  getPricingCatalog: vi.fn().mockRejectedValue(new Error('fallback')),
  createCheckoutSession: vi.fn().mockResolvedValue({
    checkout_url: 'https://checkout.stripe.com/session/test',
    session_id: 'cs_test_123',
  }),
  isApiError: () => false,
}));

const getPricingCatalogMock = vi.mocked(getPricingCatalog);

describe('PricingSection', () => {
  beforeEach(() => {
    pushMock.mockReset();
    trackEventMock.mockReset();
    getPricingCatalogMock.mockReset();
    getPricingCatalogMock.mockRejectedValue(new Error('fallback'));
    window.localStorage.clear();
    window.localStorage.setItem('sg_pricing_seed', 'pricing-test-seed');
    window.localStorage.setItem('sg_pricing_variant', 'control-layer-led');
  });

  it('renders governance-layer information hierarchy', async () => {
    render(<PricingSection />);

    expect(await screen.findByText('From First Scan to Production Protection')).toBeVisible();
    expect(await screen.findByText('Coverage Progression')).toBeVisible();
    expect(screen.getAllByText('Local and Policy Checks').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CI and Team Protection').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Production and Org Controls').length).toBeGreaterThan(0);
    expect(screen.getByText('Developer Visibility')).toBeVisible();
    expect(screen.getByText('Team Enforcement')).toBeVisible();
    expect(screen.getByText('Org Control Plane')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'SkillGate Control Stack' })).toBeVisible();
    expect(screen.getByText(/Starts at Free/i)).toBeVisible();
    expect(screen.getByText(/Starts at Pro/i)).toBeVisible();
    expect(screen.getByText(/Starts at Team/i)).toBeVisible();
    expect(screen.getAllByText(/Starts at Enterprise/i).length).toBeGreaterThan(0);
  });

  it('tracks enterprise sales-contact conversion and routes to contact', async () => {
    render(<PricingSection />);
    const button = await screen.findByRole('button', { name: /contact sales/i });

    fireEvent.click(button);

    expect(pushMock).toHaveBeenCalledWith('/contact?plan=enterprise&source=pricing');
    expect(trackEventMock).toHaveBeenCalledWith(
      'pricing_sales_contact_click',
      'enterprise_pricing_cta',
      expect.objectContaining({
        tier: 'enterprise',
      }),
    );
  });

  it('routes paid-tier CTA to free signup when beta free onboarding is enabled', async () => {
    getPricingCatalogMock.mockResolvedValueOnce({
      version: '2026-02-20',
      updated_at: '2026-02-20T00:00:00Z',
      narrative_variant_default: 'control-layer-led',
      annual_discount_percent: 17,
      beta_free_onboarding_enabled: true,
      tiers: [
        {
          id: 'free',
          name: 'Free',
          monthly_price: 0,
          yearly_price: 0,
          description: 'Free tier',
          cta: 'Get Started Free',
          highlighted: false,
          narrative: 'Developer visibility',
          control_layer_summary: 'Static Governance',
          stack_coverage: ['static_scan'],
          features: ['3 scans per day'],
          limits: [],
        },
        {
          id: 'pro',
          name: 'Pro',
          monthly_price: 49,
          yearly_price: 490,
          description: 'Pro tier',
          cta: 'Start Pro',
          highlighted: true,
          narrative: 'Full static governance',
          control_layer_summary: 'Static Governance + Policy Engine',
          stack_coverage: ['static_scan', 'policy_engine'],
          features: ['Unlimited scans'],
          limits: [],
        },
        {
          id: 'team',
          name: 'Team',
          monthly_price: 99,
          yearly_price: 990,
          description: 'Team tier',
          cta: 'Start Team',
          highlighted: false,
          narrative: 'Engineering team governance',
          control_layer_summary: 'Static + Policy + CI + Fleet Governance',
          stack_coverage: ['static_scan', 'policy_engine', 'ci_enforcement'],
          features: ['Fleet scanning'],
          limits: [],
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          monthly_price: 0,
          yearly_price: 10000,
          description: 'Enterprise tier',
          cta: 'Contact Sales',
          highlighted: false,
          strategic_label: 'AI Agent Control Plane',
          narrative: 'Foundational governance infrastructure',
          control_layer_summary: 'Full Control Stack',
          stack_coverage: [
            'static_scan',
            'policy_engine',
            'ci_enforcement',
            'runtime_gateway',
            'capability_budgets',
            'trust_propagation',
            'intelligence_graph',
          ],
          features: ['Runtime capability budgets'],
          limits: [],
          annual_contract_only: true,
        },
      ],
      control_stack_layers: [
        { id: 'static_scan', title: 'Static Scan', description: 'Deterministic static risk detection.' },
      ],
      comparison_rows: [],
    });

    render(<PricingSection />);
    const proButton = await screen.findByRole('button', { name: /Get Started Free Pro plan/i });

    fireEvent.click(proButton);

    expect(pushMock).toHaveBeenCalledWith('/signup');
    expect(pushMock).not.toHaveBeenCalledWith('/contact?plan=enterprise&source=pricing');
    expect(trackEventMock).toHaveBeenCalledWith(
      'signup_cta_click',
      'pricing_pro_beta_free',
      expect.objectContaining({
        tier: 'pro',
      }),
    );
  });

  it('expands deep matrix and tracks interaction telemetry', async () => {
    render(<PricingSection />);
    const summary = await screen.findByText('Compare Plans Across the Full Control Plane');

    fireEvent.click(summary);

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith(
        'pricing_matrix_expand',
        'expanded',
        expect.objectContaining({
          pricing_variant: 'control-layer-led',
        }),
      );
    });
    expect(screen.getByText('Compliance & Evidence')).toBeVisible();
  });

  it('tracks control-stack interactions with experiment attribution', async () => {
    render(<PricingSection />);
    const layerButton = await screen.findByRole('button', {
      name: /Control stack layer Static Scan/i,
    });

    fireEvent.click(layerButton);

    expect(trackEventMock).toHaveBeenCalledWith(
      'control_stack_interaction',
      'static_scan',
      expect.objectContaining({
        pricing_variant: 'control-layer-led',
        pricing_variant_source: 'storage',
      }),
    );
  });

  it('shows enterprise architecture preview and confidence signals', async () => {
    render(<PricingSection />);
    const runtimeDot = await screen.findByRole('button', { name: /Go to Production and Org Controls/i });
    fireEvent.click(runtimeDot);

    expect(screen.getByText('View Runtime Control Path')).toBeVisible();
    fireEvent.click(screen.getByText('View Runtime Control Path'));
    expect(
      screen.getByText(/Skill -> Policy Engine -> Runtime Gateway -> Capability Budgets -> Lineage DAG/i),
    ).toBeVisible();
    expect(screen.getByText('Custom onboarding plan')).toBeVisible();
    expect(screen.getByText('Architecture and security review support')).toBeVisible();
  });
});
