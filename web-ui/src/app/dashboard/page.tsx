/* Dashboard overview — tier-aware KPIs and recent activity. */
'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useUsageMetrics, useScans } from '@/lib/hooks/use-dashboard';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card } from '@/components/dashboard/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { TierGate } from '@/components/dashboard/TierGate';
import { InviteLinkCard } from '@/components/dashboard/InviteLinkCard';

export default function DashboardOverview() {
  const { user } = useAuth();
  const tier = user?.tier || 'free';
  const { data: usage, isLoading: usageLoading } = useUsageMetrics();
  const { data: scansData, isLoading: scansLoading } = useScans(5);

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h2 className="text-xl font-bold text-white">
          Welcome back{user?.full_name ? `, ${user.full_name}` : ''}
        </h2>
        <p className="mt-1 text-sm text-surface-400">
          Here&apos;s your security overview.
        </p>
      </div>

      <InviteLinkCard userId={user?.user_id} />

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {usageLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              label="Scans Today"
              value={usage?.scan_count_today ?? 0}
              subtext={
                usage?.scan_limit_per_day
                  ? `${usage.scan_limit_per_day - (usage.scan_count_today ?? 0)} remaining`
                  : 'Unlimited'
              }
            />
            <StatCard
              label="Total Scans"
              value={usage?.scan_count_total ?? 0}
              subtext={`${usage?.scan_count_7d ?? 0} this week`}
            />
            <StatCard
              label="Active API Keys"
              value={usage?.api_key_active_count ?? 0}
              subtext={`${usage?.api_key_count ?? 0} total`}
            />
            <StatCard
              label="Rate Limit"
              value={`${usage?.api_rate_limit_per_min ?? 10}/min`}
              subtext={`${tier} tier`}
            />
          </>
        )}
      </div>

      {/* Recent scans */}
      <Card title="Recent Scans" description="Your most recent scan activity">
        {scansLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : !scansData?.scans.length ? (
          <div className="py-8 text-center">
            <p className="text-sm text-surface-400">No scans yet.</p>
            <p className="mt-1 text-xs text-surface-500">
              Run <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-brand-400">skillgate scan ./skill</code> to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {scansData.scans.map((scan) => (
              <div
                key={scan.scan_id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-surface-200">
                    {scan.report?.bundle_name || 'Unknown bundle'}
                  </p>
                  <p className="text-xs text-surface-500">
                    {new Date(scan.stored_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-surface-200">
                    Score: {scan.report?.risk_score?.total ?? 'N/A'}
                  </span>
                  {scan.report?.policy && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        scan.report.policy.passed
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {scan.report.policy.passed ? 'Pass' : 'Fail'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pro+ features preview */}
      <TierGate
        requiredTier="pro"
        featureName="Advanced analytics"
        preview={
          <Card title="Findings Breakdown" description="Detailed analysis of your scan findings">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-white/[0.02] p-3 text-center">
                <p className="text-lg font-bold text-red-400">N/A</p>
                <p className="text-xs text-surface-500">Critical</p>
              </div>
              <div className="rounded-lg bg-white/[0.02] p-3 text-center">
                <p className="text-lg font-bold text-amber-400">N/A</p>
                <p className="text-xs text-surface-500">High</p>
              </div>
              <div className="rounded-lg bg-white/[0.02] p-3 text-center">
                <p className="text-lg font-bold text-surface-300">N/A</p>
                <p className="text-xs text-surface-500">Medium</p>
              </div>
            </div>
          </Card>
        }
      >
        <Card title="Findings Breakdown" description="Detailed analysis of your scan findings">
          <p className="text-sm text-surface-400">
            Detailed findings breakdown will populate as you scan more bundles.
          </p>
        </Card>
      </TierGate>
    </div>
  );
}
