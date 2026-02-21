/* Scan history page — list recent scans with pagination. */
'use client';

import { useState } from 'react';
import { useScans } from '@/lib/hooks/use-dashboard';
import { useAuth } from '@/components/providers/AuthProvider';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { DataTable, type Column } from '@/components/dashboard/DataTable';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { TierGate } from '@/components/dashboard/TierGate';
import { Button } from '@/components/ui/Button';
import type { ScanListItem } from '@/lib/types/dashboard';

const PAGE_SIZE = 20;

export default function ScansPage() {
  const { user } = useAuth();
  const tier = user?.tier || 'free';
  const [offset, setOffset] = useState(0);

  // Free tier: limit to 7 scans
  const limit = tier === 'free' ? 7 : PAGE_SIZE;
  const { data, isLoading } = useScans(limit, offset);

  const scans = data?.scans ?? [];
  const total = data?.total ?? 0;
  const hasNext = offset + limit < total;
  const hasPrev = offset > 0;

  const columns: Column<ScanListItem>[] = [
    {
      key: 'bundle',
      header: 'Bundle',
      render: (s) => (
        <span className="font-medium">
          {s.report?.bundle_name || 'Unknown'}
        </span>
      ),
    },
    {
      key: 'score',
      header: 'Risk Score',
      render: (s) => {
        const score = s.report?.risk_score?.total;
        if (score == null) return 'N/A';
        const color =
          score >= 100 ? 'text-red-400' :
          score >= 60 ? 'text-amber-400' :
          score >= 30 ? 'text-yellow-400' :
          'text-emerald-400';
        return <span className={`font-semibold ${color}`}>{score}</span>;
      },
    },
    {
      key: 'findings',
      header: 'Findings',
      render: (s) => s.report?.findings?.length ?? 0,
    },
    {
      key: 'policy',
      header: 'Policy',
      render: (s) => {
        if (!s.report?.policy) return 'N/A';
        return (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              s.report.policy.passed
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {s.report.policy.passed ? 'Pass' : 'Fail'}
          </span>
        );
      },
    },
    {
      key: 'date',
      header: 'Date',
      render: (s) => new Date(s.stored_at).toLocaleDateString(),
    },
  ];

  if (!isLoading && scans.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Scans" description="View your scan history." />
        <EmptyState
          title="No scans yet"
          description="Run your first scan from the CLI to see results here."
          action={
            <code className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-brand-400">
              pip install skillgate && skillgate scan ./skill
            </code>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scans"
        description={`${total} scan${total !== 1 ? 's' : ''} recorded.`}
      />

      <DataTable
        columns={columns}
        data={scans}
        keyExtractor={(s) => s.scan_id}
        loading={isLoading}
      />

      {/* Pagination (Pro+) */}
      {tier === 'free' && total > 7 ? (
        <TierGate
          requiredTier="pro"
          featureName="Full scan history"
        >
          <div />
        </TierGate>
      ) : (
        total > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-surface-500">
              Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!hasPrev}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="border-white/20 text-surface-300"
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!hasNext}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="border-white/20 text-surface-300"
              >
                Next
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
