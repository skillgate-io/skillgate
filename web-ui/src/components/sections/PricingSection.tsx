/* Pricing section with annual/monthly toggle and checkout integration */
'use client';

import React from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/AuthProvider';
import { 
  COMPARISON_ROWS,
  CONTROL_STACK_LAYERS,
  PRICING_TIERS, 
  formatPrice, 
  calculateSavings, 
  type PricingTier, 
  type BillingInterval,
  type PlanAvailability,
  type ComparisonRow,
  type ControlStackLayer,
} from '@/lib/pricing';
import { createCheckoutSession, getPricingCatalog, isApiError, type ApiError } from '@/lib/api-client';
import { trackEvent } from '@/lib/analytics';
import {
  resolvePricingExperimentFromBrowser,
  type PricingNarrativeVariant,
  type PricingExperimentSource,
} from '@/lib/pricing-experiment';

const DOCS_BASE_URL = (process.env.NEXT_PUBLIC_DOCS_BASE_URL || 'https://docs.skillgate.io').replace(/\/+$/, '');

export function PricingSection() {
  const frontendBetaFreeOnboardingEnabled =
    (process.env.NEXT_PUBLIC_PRICING_BETA_FREE_CTA || '').toLowerCase() === 'true';
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('yearly');
  const [variant, setVariant] = useState<PricingNarrativeVariant>('control-layer-led');
  const [variantSource, setVariantSource] = useState<PricingExperimentSource>('deterministic');
  const [tiers, setTiers] = useState<PricingTier[]>(PRICING_TIERS);
  const [betaFreeOnboardingEnabled, setBetaFreeOnboardingEnabled] = useState(
    frontendBetaFreeOnboardingEnabled,
  );
  const [stackLayers, setStackLayers] = useState<ControlStackLayer[]>(CONTROL_STACK_LAYERS);
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>(COMPARISON_ROWS);
  const slideScrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const touchStartXRef = useRef(0);
  const touchStartTimeRef = useRef(0);
  const touchLastXRef = useRef(0);
  const touchLastTimeRef = useRef(0);

  useEffect(() => {
    const assignment = resolvePricingExperimentFromBrowser();
    setVariant(assignment.variant);
    setVariantSource(assignment.source);
    trackEvent('pricing_experiment_view', assignment.variant, {
      variant: assignment.variant,
      source: assignment.source,
      experiment: 'pricing_narrative_v1',
    });
  }, [frontendBetaFreeOnboardingEnabled]);

  useEffect(() => {
    let mounted = true;
    getPricingCatalog()
      .then((catalog) => {
        if (!mounted) return;
        const effectiveBetaFreeOnboarding =
          frontendBetaFreeOnboardingEnabled || Boolean(catalog.beta_free_onboarding_enabled);
        setBetaFreeOnboardingEnabled(effectiveBetaFreeOnboarding);
        setTiers(
          catalog.tiers.map((tier) => ({
            id: tier.id,
            name: tier.name,
            monthlyPrice: tier.monthly_price,
            yearlyPrice: tier.yearly_price,
            period: tier.id === 'free' ? 'forever' : '/month',
            description: tier.description,
            cta:
              effectiveBetaFreeOnboarding && tier.id !== 'free'
                ? 'Get Started Free'
                : tier.cta,
            ctaVariant: tier.id === 'pro' || tier.id === 'team' ? 'primary' : 'outline',
            highlighted: tier.highlighted,
            strategicLabel: tier.strategic_label || undefined,
            annualContractOnly: tier.annual_contract_only ?? false,
            narrative: tier.narrative,
            controlLayerSummary: tier.control_layer_summary,
            stackCoverage: tier.stack_coverage,
            features: tier.features,
            limits: tier.limits,
          })),
        );
        setStackLayers(
          catalog.control_stack_layers.map((layer) => ({
            id: layer.id,
            title: layer.title,
            description: layer.description,
          })),
        );
        setComparisonRows(
          catalog.comparison_rows.map((row) => ({
            id: row.id,
            category: row.category,
            capability: row.capability,
            free: row.free,
            pro: row.pro,
            team: row.team,
            enterprise: row.enterprise,
          })),
        );
      })
      .catch(() => {
        // Keep local fallback constants when API catalog is unavailable.
        setBetaFreeOnboardingEnabled(frontendBetaFreeOnboardingEnabled);
      });

    return () => {
      mounted = false;
    };
  }, [frontendBetaFreeOnboardingEnabled]);

  const heading =
    variant === 'feature-led'
      ? 'Plans for Secure AI Delivery'
      : 'Pricing That Grows With Your Team';
  const subheading =
    variant === 'feature-led'
      ? 'Choose the plan that fits your risk level, rollout stage, and enforcement needs.'
      : 'Start with local visibility, then add CI blocking and runtime enforcement as you scale.';
  const governanceLabelByTier: Record<PricingTier['id'], string> = {
    free: 'Local Checks',
    pro: 'Policy Checks',
    team: 'Team Workflow Protection',
    enterprise: 'Organization-Wide Controls',
  };
  const categorySlides = [
    {
      id: 'static',
      title: 'Local and Policy Checks',
      subtitle: 'Start with practical scanning and clear policy decisions.',
      tierIds: ['free', 'pro'] as PricingTier['id'][],
      cardGridClassName: 'grid gap-6 md:grid-cols-2',
    },
    {
      id: 'ci-fleet',
      title: 'CI and Team Protection',
      subtitle: 'Protect pull requests and keep standards consistent across repos.',
      tierIds: ['team'] as PricingTier['id'][],
      cardGridClassName: 'grid gap-6 md:max-w-xl',
    },
    {
      id: 'runtime-org',
      title: 'Production and Org Controls',
      subtitle: 'Add stronger controls for production workflows and enterprise requirements.',
      tierIds: ['enterprise'] as PricingTier['id'][],
      cardGridClassName: 'grid gap-6 md:max-w-3xl',
    },
  ];
  const storyStages = ['Developer Visibility', 'Team Enforcement', 'Org Control Plane'];
  const narrativeProgressPercent = activeSlide <= 0 ? 20 : activeSlide === 1 ? 60 : 100;
  const tierRiskLineById: Record<PricingTier['id'], string> = {
    free: 'Visibility only. No enforcement.',
    pro: 'Detect issues, but cannot block production merges.',
    team: 'Enforce in CI, but runtime still uncontrolled.',
    enterprise: 'Enforce at execution boundary.',
  };
  const tierAudienceById: Record<PricingTier['id'], string> = {
    free: 'Individual AI developers',
    pro: 'Freelancers and solo AI builders',
    team: 'Engineering teams shipping AI workflows',
    enterprise: 'Regulated AI platforms',
  };
  const tierDepthById: Record<PricingTier['id'], number> = {
    free: 1,
    pro: 2,
    team: 3,
    enterprise: 5,
  };
  const effectiveTiers = tiers.map((tier) =>
    betaFreeOnboardingEnabled && tier.id !== 'free'
      ? { ...tier, cta: 'Get Started Free' }
      : tier,
  );

  const nearestSlideIndex = (scroller: HTMLDivElement): number => {
    const slideElements = Array.from(scroller.children) as HTMLElement[];
    if (slideElements.length === 0) return 0;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    const left = scroller.scrollLeft;
    slideElements.forEach((element, index) => {
      const distance = Math.abs(element.offsetLeft - left);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return nearestIndex;
  };

  const animateScrollerTo = (targetLeft: number, swipeVelocity = 0): void => {
    const scroller = slideScrollerRef.current;
    if (!scroller) return;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    const start = scroller.scrollLeft;
    const distance = targetLeft - start;
    const velocityFactor = Math.min(Math.max(Math.abs(swipeVelocity), 0), 2.2);
    const duration = Math.max(220, Math.round(430 - velocityFactor * 120));
    const startTime = performance.now();

    const step = (now: number): void => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Velocity-aware easing to mimic inertial gesture finish.
      const eased =
        velocityFactor > 1.1
          ? 1 - Math.pow(1 - progress, 3)
          : 1 - Math.pow(1 - progress, 4);
      scroller.scrollLeft = start + distance * eased;
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);
  };

  const goToSlide = (index: number, swipeVelocity = 0): void => {
    const scroller = slideScrollerRef.current;
    if (!scroller) return;
    const target = scroller.children.item(index) as HTMLElement | null;
    if (!target) return;
    animateScrollerTo(target.offsetLeft, swipeVelocity);
    setActiveSlide(index);
  };

  useEffect(
    () => () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  return (
    <section
      id="pricing"
      className="relative overflow-hidden bg-surface-950 py-24 sm:py-28"
      aria-labelledby="pricing-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(16,185,129,0.16),transparent_40%),radial-gradient(circle_at_20%_0%,rgba(76,110,245,0.24),transparent_35%)]" />
      <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
            From First Scan to Production Protection
          </p>
          <p className="mx-auto mb-4 inline-flex rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Flexible Pricing
          </p>
          <h2 id="pricing-heading" className="text-white">
            {heading}
          </h2>
          <p className="mt-4 text-lg text-surface-300">
            {subheading}
          </p>
          <p className="mt-3 text-sm text-surface-400">
            Free: basic visibility. Pro: stronger policy checks. Team: CI protection across repos.
            Enterprise: advanced controls and evidence for high-trust environments.
          </p>

        </div>

        <ControlStack
          variant={variant}
          variantSource={variantSource}
          layers={stackLayers}
          tiers={effectiveTiers}
        />

        <div className="relative mt-16 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-2 text-sm font-semibold uppercase tracking-[0.14em] text-surface-300">
                Coverage Progression
              </p>
              <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-emerald-200">
                Local and Policy Checks
              </span>
              <span className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-cyan-200">
                CI and Team Protection
              </span>
              <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-amber-200">
                Production and Org Controls
              </span>
            </div>
            <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1 backdrop-blur">
              <button
                type="button"
                onClick={() => {
                  setBillingInterval('monthly');
                  trackEvent('pricing_interval_change', 'monthly', {
                    pricing_variant: variant,
                    pricing_variant_source: variantSource,
                  });
                }}
                className={cn(
                  'rounded-md px-4 py-2 text-sm font-medium transition-all duration-200',
                  billingInterval === 'monthly'
                    ? 'bg-white text-surface-950 shadow-md'
                    : 'text-surface-300 hover:text-white',
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => {
                  setBillingInterval('yearly');
                  trackEvent('pricing_interval_change', 'yearly', {
                    pricing_variant: variant,
                    pricing_variant_source: variantSource,
                  });
                }}
                className={cn(
                  'rounded-md px-4 py-2 text-sm font-medium transition-all duration-200',
                  billingInterval === 'yearly'
                    ? 'bg-white text-surface-950 shadow-md'
                    : 'text-surface-300 hover:text-white',
                )}
              >
                Yearly
                <span
                  className={cn(
                    'ml-1.5 text-xs',
                    billingInterval === 'yearly' ? 'text-emerald-700' : 'text-emerald-300',
                  )}
                >
                  Save 17%
                </span>
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="mr-2 text-sm font-semibold uppercase tracking-[0.14em] text-surface-300">
              Billing
            </p>
            <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-emerald-200">
              Yearly saves 17%
            </span>
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-surface-950/50 p-4">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-400">
              {storyStages.map((stage, index) => (
                <span
                  key={stage}
                  className={cn(
                    'transition-colors duration-300',
                    index <= activeSlide ? 'text-emerald-200' : 'text-surface-500',
                  )}
                >
                  {stage}
                </span>
              ))}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-amber-300 transition-all duration-500"
                style={{ width: `${narrativeProgressPercent}%` }}
              />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-surface-300">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 text-[10px] font-bold text-emerald-200">
                L
              </span>
              Each step adds stronger prevention and tighter runtime boundaries.
            </div>
          </div>
          <p className="mt-3 text-sm text-surface-300">
            Pick a plan by how much control you need in real production paths.
          </p>
          <div
            ref={slideScrollerRef}
            tabIndex={0}
            role="region"
            aria-roledescription="carousel"
            aria-label="Pricing categories carousel"
            className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 pr-10 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:gap-5 sm:pr-12 md:gap-6 md:pr-0"
            onScroll={(event) => {
              const target = event.currentTarget;
              const index = nearestSlideIndex(target);
              if (index !== activeSlide && index >= 0 && index < categorySlides.length) {
                setActiveSlide(index);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                goToSlide(Math.min(activeSlide + 1, categorySlides.length - 1));
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                goToSlide(Math.max(activeSlide - 1, 0));
              }
            }}
            onTouchStart={(event) => {
              const touch = event.touches[0];
              if (!touch) return;
              touchStartXRef.current = touch.clientX;
              touchLastXRef.current = touch.clientX;
              touchStartTimeRef.current = performance.now();
              touchLastTimeRef.current = touchStartTimeRef.current;
            }}
            onTouchMove={(event) => {
              const touch = event.touches[0];
              if (!touch) return;
              touchLastXRef.current = touch.clientX;
              touchLastTimeRef.current = performance.now();
            }}
            onTouchEnd={() => {
              const scroller = slideScrollerRef.current;
              if (!scroller) return;
              const deltaX = touchStartXRef.current - touchLastXRef.current;
              const durationMs = Math.max(touchLastTimeRef.current - touchStartTimeRef.current, 1);
              const signedVelocityPxPerMs = deltaX / durationMs;
              const velocityPxPerMs = Math.abs(signedVelocityPxPerMs);
              const isFastSwipe = velocityPxPerMs > 0.55;
              const hasDistance = Math.abs(deltaX) > scroller.clientWidth * 0.14;
              const baseIndex = nearestSlideIndex(scroller);
              let targetIndex = baseIndex;
              if (isFastSwipe || hasDistance) {
                const direction = deltaX > 0 ? 1 : -1;
                targetIndex = Math.min(
                  Math.max(baseIndex + direction, 0),
                  categorySlides.length - 1,
                );
              }
              goToSlide(targetIndex, signedVelocityPxPerMs);
            }}
          >
            {categorySlides.map((slide) => {
              const slideTiers = slide.tierIds
                .map((id) => effectiveTiers.find((tier) => tier.id === id))
                .filter((tier): tier is PricingTier => Boolean(tier));
              return (
                <section
                  key={slide.id}
                  className="w-[88%] flex-none snap-start rounded-2xl border border-white/10 bg-surface-950/45 p-5 sm:w-[92%] md:w-full md:p-6"
                  aria-label={`${slide.title} tab`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200/90">
                    {slide.title}
                  </p>
                  <p className="mt-2 text-sm text-surface-300">{slide.subtitle}</p>
                  <div className={cn('mt-5', slide.cardGridClassName)}>
                    {slideTiers.map((tier) => (
                      <PricingCard
                        key={tier.id}
                        tier={tier}
                        billingInterval={billingInterval}
                        variant={variant}
                        variantSource={variantSource}
                        categoryLabel={governanceLabelByTier[tier.id]}
                        riskLine={tierRiskLineById[tier.id]}
                        designedFor={tierAudienceById[tier.id]}
                        governanceDepth={tierDepthById[tier.id]}
                        forceFreeOnboarding={betaFreeOnboardingEnabled}
                        cardClassName={tier.id === 'enterprise' ? 'md:max-w-3xl' : undefined}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-center gap-3" aria-label="Pricing slide navigation">
            <button
              type="button"
              onClick={() => goToSlide(Math.max(activeSlide - 1, 0))}
              disabled={activeSlide === 0}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition',
                activeSlide === 0
                  ? 'pointer-events-none border-white/10 text-surface-600 opacity-40'
                  : 'border-white/15 text-surface-200 hover:border-white/35 hover:text-white',
              )}
              aria-label="Previous pricing category"
            >
              {'<'}
            </button>
            {categorySlides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goToSlide(index)}
                className={cn(
                  'h-2.5 w-2.5 rounded-full border transition',
                  index === activeSlide
                    ? 'border-emerald-300 bg-emerald-300'
                    : 'border-white/40 bg-transparent hover:border-white/70',
                )}
                aria-label={`Go to ${slide.title}`}
                aria-current={index === activeSlide}
              />
            ))}
            <button
              type="button"
              onClick={() => goToSlide(Math.min(activeSlide + 1, categorySlides.length - 1))}
              disabled={activeSlide === categorySlides.length - 1}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition',
                activeSlide === categorySlides.length - 1
                  ? 'pointer-events-none border-white/10 text-surface-600 opacity-40'
                  : 'border-white/15 text-surface-200 hover:border-white/35 hover:text-white',
              )}
              aria-label="Next pricing category"
            >
              {'>'}
            </button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-surface-950/45 p-4">
              <h4 className="text-sm font-semibold text-white">When Teams Usually Move to Team</h4>
              <ul className="mt-3 space-y-2 text-sm text-surface-300">
                <li>You need reliable merge blocking in CI, not just warnings.</li>
                <li>You need one view across multiple repos and skill bundles.</li>
                <li>You need policy drift tracking at the org level.</li>
              </ul>
            </article>
            <article className="rounded-2xl border border-amber-300/25 bg-amber-500/[0.06] p-4">
              <h4 className="text-sm font-semibold text-amber-100">When Programs Move to Enterprise</h4>
              <ul className="mt-3 space-y-2 text-sm text-surface-200">
                <li>You must enforce controls at runtime, not only at PR time.</li>
                <li>You need evidence packs ready for reviews and audits.</li>
                <li>You require private relay or disconnected deployment models.</li>
                <li>You need clear decision logs for security and compliance teams.</li>
              </ul>
            </article>
          </div>
        </div>

        <DeepComparisonMatrix variant={variant} variantSource={variantSource} rows={comparisonRows} />
      </div>
    </section>
  );
}

function ControlStack({
  variant,
  variantSource,
  layers,
  tiers,
}: {
  variant: PricingNarrativeVariant;
  variantSource: PricingExperimentSource;
  layers: ControlStackLayer[];
  tiers: PricingTier[];
}) {
  const tierOrder: PricingTier['id'][] = ['free', 'pro', 'team', 'enterprise'];
  const tierLabel: Record<PricingTier['id'], string> = {
    free: 'Free',
    pro: 'Pro',
    team: 'Team',
    enterprise: 'Enterprise',
  };

  const unlockedAtByLayer = new Map<ControlStackLayer['id'], PricingTier['id']>();
  for (const layer of layers) {
    const firstTier = tierOrder.find((tierId) =>
      tiers.some((tier) => tier.id === tierId && tier.stackCoverage.includes(layer.id)),
    );
    if (firstTier) {
      unlockedAtByLayer.set(layer.id, firstTier);
    }
  }

  return (
    <div className="relative mt-12 rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur sm:p-8">
      <h3 className="text-xl font-semibold text-white">SkillGate Control Stack</h3>
      <p className="mt-2 text-sm text-surface-300">
        Three layers: static policy checks, CI enforcement, then runtime and org controls.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {layers.map((layer) => (
          <button
            key={layer.id}
            type="button"
            onClick={() =>
              trackEvent('control_stack_interaction', layer.id, {
                pricing_variant: variant,
                pricing_variant_source: variantSource,
                layer: layer.id,
              })
            }
            className="rounded-2xl border border-white/10 bg-surface-950/60 p-4 text-left transition hover:border-emerald-300/40 hover:bg-surface-900/80"
            aria-label={`Control stack layer ${layer.title}`}
          >
            <p className="text-sm font-semibold text-emerald-300">{layer.title}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-surface-500">
              Starts at {tierLabel[unlockedAtByLayer.get(layer.id) ?? 'enterprise']}
            </p>
            <p className="mt-2 text-xs text-surface-400">{layer.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function PricingCard({ 
  tier, 
  billingInterval,
  variant,
  variantSource,
  categoryLabel,
  riskLine,
  designedFor,
  governanceDepth,
  forceFreeOnboarding,
  cardClassName,
}: { 
  tier: PricingTier; 
  billingInterval: BillingInterval;
  variant: PricingNarrativeVariant;
  variantSource: PricingExperimentSource;
  categoryLabel: string;
  riskLine: string;
  designedFor: string;
  governanceDepth: number;
  forceFreeOnboarding: boolean;
  cardClassName?: string;
}) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingIdempotencyKey = useRef<string | null>(null);

  const displayPrice = formatPrice(tier, billingInterval);
  const savings = calculateSavings(tier);
  const period =
    tier.id === 'free'
      ? 'forever'
      : tier.id === 'enterprise'
        ? 'Annual contract'
        : billingInterval === 'yearly'
          ? '/month, billed annually'
          : '/month';

  const handleCheckout = async () => {
    if (loading) {
      return;
    }

    trackEvent('pricing_cta_click', `${tier.id}_card`, {
      tier: tier.id,
      billing_interval: billingInterval,
      pricing_variant: variant,
      pricing_variant_source: variantSource,
    });

    if (forceFreeOnboarding) {
      trackEvent('signup_cta_click', `pricing_${tier.id}_beta_free`, {
        tier: tier.id,
        pricing_variant: variant,
        pricing_variant_source: variantSource,
      });
      if (isAuthenticated) {
        window.location.href = `${DOCS_BASE_URL}/get-started`;
      } else {
        router.push('/signup');
      }
      return;
    }

    // Task 17.45: Track checkout start with tier and interval
    if (tier.id !== 'free' && tier.id !== 'enterprise') {
      trackEvent('checkout_start', tier.id, {
        tier: tier.id,
        billing_interval: billingInterval,
        pricing_variant: variant,
        pricing_variant_source: variantSource,
      });
    }
    setError(null);

    // Free tier — start onboarding/auth flow
    if (tier.id === 'free') {
      if (isAuthenticated) {
        window.location.href = `${DOCS_BASE_URL}/get-started`;
      } else {
        router.push('/signup');
      }
      return;
    }

    // Enterprise — route to in-app contact instead of opening email client directly
    if (tier.id === 'enterprise') {
      trackEvent('pricing_sales_contact_click', 'enterprise_pricing_cta', {
        tier: tier.id, 
        billing_interval: billingInterval,
        pricing_variant: variant,
        pricing_variant_source: variantSource,
      });
      router.push('/contact?plan=enterprise&source=pricing');
      return;
    }

    // 16.14: Idempotent checkout — safe to click multiple times
    setLoading(true);
    if (!pendingIdempotencyKey.current) {
      pendingIdempotencyKey.current = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `sg-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
    }

    try {
      const result = await createCheckoutSession({
        tier: tier.id,
        billing_interval: billingInterval, // Task 17.44: Include billing interval
        success_url: `${window.location.origin}/success`,
        cancel_url: `${window.location.origin}/cancel`,
      }, pendingIdempotencyKey.current);

      // Task 17.45: Track successful checkout redirect
      trackEvent('checkout_success', tier.id, { 
        tier: tier.id, 
        billing_interval: billingInterval,
        pricing_variant: variant,
        pricing_variant_source: variantSource,
      });

      // Contract (7.3): redirect to Stripe-hosted URL only
      window.location.href = result.checkout_url;
    } catch (err) {
      // 16.14: Map to actionable error state
      const apiError: ApiError = isApiError(err)
        ? err
        : { status: 0, code: 'UNKNOWN', message: 'Unable to start checkout. Please try again.', retryable: true };

      const message = ['NETWORK_ERROR', 'SERVER_ERROR', 'SERVICE_UNAVAILABLE'].includes(apiError.code)
        ? 'Checkout is temporarily unavailable. Please try again in a few minutes.'
        : apiError.message;
      setError(message);
      trackEvent('checkout_error', tier.id, {
        tier: tier.id,
        billing_interval: billingInterval,
        pricing_variant: variant,
        pricing_variant_source: variantSource,
        error_code: apiError.code,
      });
    } finally {
      setLoading(false);
      pendingIdempotencyKey.current = null;
    }
  };

  const visibleFeatures = tier.id === 'enterprise' ? tier.features.slice(0, 8) : tier.features;
  const hiddenFeatures = tier.id === 'enterprise' ? tier.features.slice(8) : [];

  return (
    <article
      className={cn(
        'relative flex flex-col rounded-3xl border p-6 text-white backdrop-blur transition duration-300',
        tier.id === 'enterprise' &&
          'border-amber-300/70 bg-gradient-to-b from-amber-500/18 via-amber-300/8 to-surface-950/80 shadow-[0_0_0_1px_rgba(251,191,36,0.4),0_32px_96px_rgba(251,191,36,0.2)]',
        tier.highlighted
          ? 'border-emerald-300/60 bg-emerald-500/12 shadow-[0_0_0_1px_rgba(16,185,129,0.25),0_24px_80px_rgba(16,185,129,0.2)]'
          : 'border-white/15 bg-white/[0.05] hover:border-white/25',
        cardClassName,
      )}
    >
      {tier.highlighted && (
        <Badge variant="brand" className="absolute -top-3 left-1/2 -translate-x-1/2">
          Most Popular
        </Badge>
      )}

      <div className="mb-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200/90">
          {categoryLabel}
        </p>
        {tier.strategicLabel && (
          <div className="mb-2 flex flex-wrap gap-2">
            <p className="inline-flex rounded-full border border-amber-300/35 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200">
              {tier.strategicLabel}
            </p>
            <p className="inline-flex rounded-full border border-emerald-300/35 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-200">
              Production Tier
            </p>
          </div>
        )}
        <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
        <p className="mt-1 text-xs font-medium text-amber-100/90">{riskLine}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-surface-400">
          Designed for: {designedFor}
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-surface-400">{tier.narrative}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.12em] text-surface-400">Governance Depth</span>
          <div className="flex gap-1" aria-label={`Governance depth ${governanceDepth} out of 5`}>
            {Array.from({ length: 5 }).map((_, index) => (
              <span
                key={`${tier.id}-depth-${index}`}
                className={cn(
                  'h-2 w-2 rounded-full border',
                  index < governanceDepth
                    ? 'border-emerald-300 bg-emerald-300'
                    : 'border-white/30 bg-transparent',
                )}
              />
            ))}
          </div>
        </div>
        <div
          className={cn(
            'mt-2 flex',
            tier.id === 'enterprise' ? 'flex-col items-start gap-1' : 'items-baseline',
          )}
        >
          <span
            className={cn(
              'font-bold text-white',
              tier.id === 'enterprise' ? 'text-3xl leading-tight' : 'text-4xl',
            )}
          >
            {displayPrice}
          </span>
          <span
            className={cn(
              'text-surface-400',
              tier.id === 'enterprise' ? 'text-xs leading-tight' : 'ml-1',
            )}
          >
            {period}
          </span>
        </div>
        {billingInterval === 'yearly' && savings > 0 && (
          <p className="mt-1 text-sm font-medium text-emerald-400">
            Save {savings}% with annual billing
          </p>
        )}
        <p className="mt-2 text-sm text-surface-300">{tier.description}</p>
        <p className="mt-2 text-xs text-emerald-300">{tier.controlLayerSummary}</p>
        {tier.id === 'enterprise' && (
          <>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Enterprise control-plane anchors">
              <li className="rounded-full border border-amber-300/35 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">
                Runtime Budgets
              </li>
              <li className="rounded-full border border-amber-300/35 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">
                Trust DAG
              </li>
              <li className="rounded-full border border-amber-300/35 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">
                Compliance Exports
              </li>
            </ul>
            <details className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/[0.05] p-3">
              <summary className="cursor-pointer text-sm font-semibold text-amber-100">
                View Runtime Control Path
              </summary>
              <p className="mt-2 text-xs text-surface-200">
                Skill -&gt; Policy Engine -&gt; Runtime Gateway -&gt; Capability Budgets -&gt; Lineage DAG
              </p>
            </details>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-amber-100">
              <span className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-2 py-1">EU AI Act</span>
              <span className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-2 py-1">SOC2</span>
              <span className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-2 py-1">On-prem</span>
              <span className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-2 py-1">Air-gap</span>
              <span className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-2 py-1 col-span-2">Signed AI-BOM</span>
            </div>
          </>
        )}
      </div>

      <ul className="mb-8 flex-1 space-y-3" role="list" aria-label={`${tier.name} plan features`}>
        {visibleFeatures.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-surface-200">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </li>
        ))}
        {hiddenFeatures.length > 0 && (
          <li className="list-none">
            <details className="rounded-xl border border-white/10 bg-surface-950/50 p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.11em] text-surface-300">
                View all enterprise capabilities
              </summary>
              <ul className="mt-2 space-y-2">
                {hiddenFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-surface-300">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        )}
        {tier.limits.map((limit) => (
          <li key={limit} className="flex items-start gap-2 text-sm text-surface-500">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {limit}
          </li>
        ))}
      </ul>

      {/* 16.14: Error state — always actionable */}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-300/50 bg-red-500/10 p-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      <Button
        variant={tier.highlighted ? 'primary' : 'outline'}
        className="w-full"
        loading={loading}
        onClick={() => void handleCheckout()}
        aria-label={`${tier.cta} ${tier.name} plan at ${displayPrice} ${period}`}
      >
        {tier.cta}
      </Button>
      {tier.id === 'enterprise' && (
        <ul className="mt-4 space-y-1 text-xs text-surface-300">
          <li>Custom onboarding plan</li>
          <li>Architecture and security review support</li>
          <li>Dedicated support engineer</li>
        </ul>
      )}
    </article>
  );
}

function availabilityLabel(value: PlanAvailability): { text: string; className: string } {
  if (value === 'yes') return { text: 'Included', className: 'text-emerald-300' };
  if (value === 'partial') return { text: 'Limited', className: 'text-amber-300' };
  return { text: 'Not included', className: 'text-surface-500' };
}

function DeepComparisonMatrix({
  variant,
  variantSource,
  rows,
}: {
  variant: PricingNarrativeVariant;
  variantSource: PricingExperimentSource;
  rows: ComparisonRow[];
}) {
  let lastCategory: ComparisonRow['category'] | null = null;

  return (
    <details
      className="group mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur"
      onToggle={(event) => {
        const target = event.currentTarget as HTMLDetailsElement;
        if (target.open) {
          trackEvent('pricing_matrix_expand', 'expanded', {
            pricing_variant: variant,
            pricing_variant_source: variantSource,
          });
        }
      }}
    >
      <summary className="flex cursor-pointer items-center justify-between text-left text-lg font-semibold text-white [&::-webkit-details-marker]:hidden">
        <span>Compare Plans Across the Full Control Plane</span>
        <svg
          className="h-5 w-5 text-surface-300 transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <p className="mt-3 text-sm text-surface-400">
        Full capability matrix across policy, CI, runtime, and compliance needs.
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-2 text-sm" aria-label="Pricing comparison matrix">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-surface-400">
              <th className="px-3 py-2">Capability</th>
              <th className="px-3 py-2">Free</th>
              <th className="px-3 py-2">Pro</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Enterprise</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const free = availabilityLabel(row.free);
              const pro = availabilityLabel(row.pro);
              const team = availabilityLabel(row.team);
              const enterprise = availabilityLabel(row.enterprise);
              const renderCategory = row.category !== lastCategory;
              if (renderCategory) {
                lastCategory = row.category;
              }
              return (
                <tr key={row.id} className="rounded-xl bg-surface-950/60">
                  <td className="rounded-l-xl px-3 py-3 text-surface-100">
                    {renderCategory && (
                      <p className="mb-1 text-[11px] uppercase tracking-[0.13em] text-emerald-300">
                        {row.category}
                      </p>
                    )}
                    <p className="font-medium">{row.capability}</p>
                  </td>
                  <td className={cn('px-3 py-3', free.className)}>{free.text}</td>
                  <td className={cn('px-3 py-3', pro.className)}>{pro.text}</td>
                  <td className={cn('px-3 py-3', team.className)}>{team.text}</td>
                  <td className={cn('rounded-r-xl px-3 py-3 font-semibold', enterprise.className)}>
                    {enterprise.text}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-5 flex flex-wrap gap-3 text-xs text-surface-400">
        <Link
          className="rounded-full border border-white/10 px-3 py-1 hover:border-white/25 hover:text-white"
          href={`${DOCS_BASE_URL}/enterprise/procurement`}
          onClick={() =>
            trackEvent('pricing_matrix_link_click', 'enterprise_procurement_guide', {
              pricing_variant: variant,
              pricing_variant_source: variantSource,
            })
          }
        >
          Procurement Guide
        </Link>
        <Link
          className="rounded-full border border-white/10 px-3 py-1 hover:border-white/25 hover:text-white"
          href={`${DOCS_BASE_URL}/enterprise/compliance`}
          onClick={() =>
            trackEvent('pricing_matrix_link_click', 'enterprise_compliance_modes', {
              pricing_variant: variant,
              pricing_variant_source: variantSource,
            })
          }
        >
          Compliance Guide
        </Link>
        <Link
          className="rounded-full border border-white/10 px-3 py-1 hover:border-white/25 hover:text-white"
          href={`${DOCS_BASE_URL}/enterprise/deployment`}
          onClick={() =>
            trackEvent('pricing_matrix_link_click', 'enterprise_deployment_models', {
              pricing_variant: variant,
              pricing_variant_source: variantSource,
            })
          }
        >
          Deployment Guide
        </Link>
      </div>
    </details>
  );
}
