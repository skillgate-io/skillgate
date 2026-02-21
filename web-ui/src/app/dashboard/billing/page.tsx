/* Billing page — current plan, upgrade CTAs, manage subscription. */
'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useUsageMetrics, useCustomerPortal } from '@/lib/hooks/use-dashboard';
import { PRICING_TIERS } from '@/lib/pricing';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Card } from '@/components/dashboard/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import Link from 'next/link';

export default function BillingPage() {
  const { user } = useAuth();
  const { data: usage, isLoading } = useUsageMetrics();
  const portalMutation = useCustomerPortal();

  const tier = user?.tier || 'free';
  const currentPlan = PRICING_TIERS.find((t) => t.id === tier);
  const hasSubscription = user?.subscription_status === 'active';

  // Plans to show for upgrade
  const upgradeTiers = PRICING_TIERS.filter(
    (t) => t.id !== 'free' && t.id !== tier,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Manage your plan and subscription."
      />

      {/* Current plan */}
      <Card title="Current Plan">
        {isLoading ? (
          <Skeleton className="h-20 rounded-lg" />
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold capitalize text-white">
                  {tier}
                </span>
                {hasSubscription && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                    Active
                  </span>
                )}
              </div>
              {currentPlan && (
                <p className="mt-1 text-sm text-surface-400">
                  {tier === 'free'
                    ? 'Free forever'
                    : `$${currentPlan.monthlyPrice}/mo`}
                  {user?.billing_interval === 'yearly' && ' (annual billing)'}
                </p>
              )}
              {user?.current_period_end && (
                <p className="mt-0.5 text-xs text-surface-500">
                  {user.cancel_at_period_end
                    ? 'Cancels'
                    : 'Renews'}{' '}
                  on {new Date(user.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>

            {hasSubscription && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => portalMutation.mutate()}
                loading={portalMutation.isPending}
                className="border-white/20 text-surface-200"
              >
                Manage Subscription
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Usage vs limits */}
      <Card title="Usage Summary">
        {isLoading ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-surface-500">Scans/day</p>
              <p className="text-sm font-medium text-surface-200">
                {usage?.scan_limit_per_day ?? 'Unlimited'}
              </p>
            </div>
            <div>
              <p className="text-xs text-surface-500">API rate</p>
              <p className="text-sm font-medium text-surface-200">
                {usage?.api_rate_limit_per_min ?? 10}/min
              </p>
            </div>
            <div>
              <p className="text-xs text-surface-500">API keys</p>
              <p className="text-sm font-medium text-surface-200">
                {usage?.api_key_active_count ?? 0} active
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Upgrade options */}
      {tier !== 'enterprise' && (
        <div>
          <h3 className="mb-4 text-sm font-semibold text-surface-200">
            {tier === 'free' ? 'Upgrade Your Plan' : 'Available Plans'}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upgradeTiers.map((plan) => (
              <div
                key={plan.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
              >
                <h4 className="text-base font-semibold capitalize text-white">
                  {plan.id}
                </h4>
                <p className="mt-1 text-2xl font-bold text-white">
                  {plan.id === 'enterprise'
                    ? 'Custom'
                    : `$${plan.monthlyPrice}`}
                  {plan.id !== 'enterprise' && (
                    <span className="text-sm font-normal text-surface-400">/mo</span>
                  )}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-surface-400">
                      <span className="mt-0.5 text-emerald-400">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  {plan.id === 'enterprise' ? (
                    <a
                      href="mailto:contact@skillgate.io?subject=Enterprise%20Plan%20Inquiry"
                      className="inline-flex w-full items-center justify-center rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-surface-200 transition-colors hover:bg-white/5"
                    >
                      Contact Sales
                    </a>
                  ) : (
                    <Link
                      href="/pricing"
                      className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
                    >
                      Upgrade to {plan.id}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
