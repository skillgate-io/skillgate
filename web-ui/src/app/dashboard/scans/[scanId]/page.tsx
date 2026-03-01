/* Scan detail page — inspect full report payload for a single stored scan. */
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useScan } from '@/lib/hooks/use-dashboard';
import { docsUrl, useDocsBaseUrl } from '@/lib/docs-links';

type Finding = {
  rule_id?: string;
  severity?: string;
  message?: string;
  [key: string]: unknown;
};

function severityClass(severity: string): string {
  const level = severity.toLowerCase();
  if (level === 'critical') return 'bg-red-500/20 text-red-400';
  if (level === 'high') return 'bg-orange-500/20 text-orange-300';
  if (level === 'medium') return 'bg-amber-500/20 text-amber-300';
  if (level === 'low') return 'bg-yellow-500/20 text-yellow-300';
  return 'bg-white/10 text-surface-300';
}

export default function ScanDetailPage() {
  const params = useParams<{ scanId: string }>();
  const scanId = params?.scanId || '';
  const docsBaseUrl = useDocsBaseUrl();
  const { data, isLoading } = useScan(scanId);
  const [view, setView] = useState<'table' | 'json'>('table');

  const findings = useMemo<Finding[]>(() => {
    const rawFindings = (data?.report as { findings?: unknown } | undefined)?.findings;
    if (!Array.isArray(rawFindings)) {
      return [];
    }
    return rawFindings
      .map((item) => (typeof item === 'object' && item !== null ? (item as Finding) : null))
      .filter((item): item is Finding => item !== null);
  }, [data?.report]);

  const score =
    typeof data?.report?.risk_score === 'object' && data?.report?.risk_score
      ? (data.report.risk_score as { total?: unknown }).total
      : null;
  const totalScore = typeof score === 'number' ? score : null;
  const policy =
    typeof data?.report?.policy === 'object' && data?.report?.policy
      ? (data.report.policy as { passed?: unknown }).passed
      : null;
  const policyPassed = typeof policy === 'boolean' ? policy : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scan Details"
        description={scanId ? `Scan ID: ${scanId}` : 'Scan report details'}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-surface-500">
          <p>
            {data?.stored_at ? `Stored: ${new Date(data.stored_at).toLocaleString()}` : 'Loading...'}
          </p>
          <span className="text-surface-600">•</span>
          <a
            href={docsUrl(docsBaseUrl, '/rules')}
            className="text-brand-300 hover:text-brand-200"
            target="_blank"
            rel="noreferrer"
          >
            Rule Catalog
          </a>
          <a
            href={docsUrl(docsBaseUrl, '/policy')}
            className="text-brand-300 hover:text-brand-200"
            target="_blank"
            rel="noreferrer"
          >
            Policy Reference
          </a>
        </div>
        <Link
          href="/dashboard/scans"
          className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-surface-300 hover:border-brand-500 hover:text-brand-300"
        >
          Back to Scans
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs text-surface-500">Risk Score</p>
          <p className="mt-1 text-lg font-semibold text-surface-100">{totalScore ?? 'N/A'}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs text-surface-500">Findings</p>
          <p className="mt-1 text-lg font-semibold text-surface-100">{findings.length}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs text-surface-500">Policy</p>
          <p
            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-sm font-semibold ${
              policyPassed == null
                ? 'bg-white/10 text-surface-300'
                : policyPassed
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/20 text-red-400'
            }`}
          >
            {policyPassed == null ? 'N/A' : policyPassed ? 'Pass' : 'Fail'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-surface-200">Scan Report</h2>
          <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setView('table')}
              className={`rounded-md px-3 py-1.5 text-xs ${
                view === 'table' ? 'bg-white/10 text-surface-100' : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setView('json')}
              className={`rounded-md px-3 py-1.5 text-xs ${
                view === 'json' ? 'bg-white/10 text-surface-100' : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              JSON
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-surface-400">Loading scan report...</p>
        ) : view === 'json' ? (
          <pre className="w-full min-w-0 max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-4 text-xs text-surface-200">
            {JSON.stringify(data?.report ?? {}, null, 2)}
          </pre>
        ) : findings.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-surface-300">
            No findings were reported in this scan.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-black/30 text-left text-xs uppercase tracking-wide text-surface-500">
                <tr>
                  <th className="px-4 py-3">Rule</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((finding, index) => {
                  const ruleId = typeof finding.rule_id === 'string' ? finding.rule_id : 'Unknown';
                  const severity = typeof finding.severity === 'string' ? finding.severity : 'unknown';
                  const message = typeof finding.message === 'string' ? finding.message : '';
                  return (
                    <tr key={`${ruleId}-${index}`} className="border-t border-white/10">
                      <td className="px-4 py-3 align-top font-mono text-xs text-surface-300">{ruleId}</td>
                      <td className="px-4 py-3 align-top">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityClass(severity)}`}>
                          {severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-surface-200">{message || 'No message provided.'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
