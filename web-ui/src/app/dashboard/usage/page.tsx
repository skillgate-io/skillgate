/* Usage metrics page — scan usage, rate limits, API key summary. */
'use client';

import { useUsageMetrics } from '@/lib/hooks/use-dashboard';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Card } from '@/components/dashboard/Card';
import { StatCard } from '@/components/dashboard/StatCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { TierGate } from '@/components/dashboard/TierGate';

export default function UsagePage() {
  const { data: usage, isLoading } = useUsageMetrics();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Usage" description="Monitor your usage and limits." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const scanLimit = usage?.scan_limit_per_day;
  const scansToday = usage?.scan_count_today ?? 0;
  const scanPct = scanLimit ? Math.min((scansToday / scanLimit) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Usage" description="Monitor your usage and limits." />

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Scans Today" value={scansToday} subtext={scanLimit ? `of ${scanLimit} daily limit` : 'Unlimited'} />
        <StatCard label="Scans This Week" value={usage?.scan_count_7d ?? 0} />
        <StatCard label="Scans This Month" value={usage?.scan_count_30d ?? 0} />
        <StatCard label="Total Scans" value={usage?.scan_count_total ?? 0} />
        <StatCard label="Active API Keys" value={usage?.api_key_active_count ?? 0} subtext={`${usage?.api_key_count ?? 0} total`} />
        <StatCard label="API Rate Limit" value={`${usage?.api_rate_limit_per_min ?? 10}/min`} subtext={`${usage?.tier ?? 'free'} tier`} />
      </div>

      {/* Daily scan usage bar */}
      {scanLimit && (
        <Card title="Daily Scan Usage">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-400">
                {scansToday} / {scanLimit} scans used
              </span>
              <span className="font-medium text-surface-200">
                {Math.round(scanPct)}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  scanPct >= 90 ? 'bg-red-500' : scanPct >= 70 ? 'bg-amber-500' : 'bg-brand-500'
                }`}
                style={{ width: `${scanPct}%` }}
              />
            </div>
            {scanPct >= 90 && (
              <p className="text-xs text-amber-400">
                You&apos;re approaching your daily limit. Upgrade to Pro for unlimited scans.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Last scan */}
      <Card title="Last Scan">
        <p className="text-sm text-surface-300">
          {usage?.last_scan_at
            ? new Date(usage.last_scan_at).toLocaleString()
            : 'No scans recorded yet.'}
        </p>
      </Card>

      {/* Detailed analytics — Pro+ */}
      <TierGate
        requiredTier="pro"
        featureName="Detailed usage analytics"
        preview={
          <Card title="Scan Trends (30 Days)">
            <div className="flex h-32 items-end gap-1">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-white/[0.06]"
                  style={{ height: `${20 + Math.random() * 60}%` }}
                />
              ))}
            </div>
          </Card>
        }
      >
        <Card title="Scan Trends (30 Days)">
          <p className="text-sm text-surface-400">
            Detailed scan trend data will be available as you use the platform.
          </p>
        </Card>
      </TierGate>
    </div>
  );
}
