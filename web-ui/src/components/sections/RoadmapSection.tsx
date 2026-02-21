'use client';

import { useEffect, useMemo, useState } from 'react';
import { getMarketingRoadmap, isApiError, type MarketingRoadmapItem, type MarketingRoadmapResponse } from '@/lib/api-client';
import { ROADMAP_FALLBACK } from '@/lib/roadmap-fallback';

const STATUS_LABELS: Record<string, string> = {
  live: 'Live',
  removed_from_ui: 'Planned',
  planned: 'Planned',
  in_progress: 'In Progress',
};

const STATUS_STYLES: Record<string, string> = {
  live: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200',
  removed_from_ui: 'border-slate-400/30 bg-slate-500/10 text-slate-200',
  planned: 'border-blue-400/30 bg-blue-500/15 text-blue-200',
  in_progress: 'border-amber-400/35 bg-amber-500/15 text-amber-200',
};

const TIER_ORDER = ['free', 'pro', 'team', 'enterprise', 'multi-tier'] as const;
const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team',
  enterprise: 'Enterprise',
  'multi-tier': 'Multi-tier',
};

type RoadmapView = 'timeline' | 'board';
type TierFilter = 'all' | 'free' | 'pro' | 'team' | 'enterprise' | 'multi-tier';

const STATUS_ORDER = ['live', 'in_progress', 'planned', 'removed_from_ui'] as const;
const STATUS_TITLES: Record<string, string> = {
  live: 'Live',
  in_progress: 'In Progress',
  planned: 'Planned',
  removed_from_ui: 'Planned',
};

export function RoadmapSection() {
  const [roadmap, setRoadmap] = useState<MarketingRoadmapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<RoadmapView>('timeline');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getMarketingRoadmap()
      .then((data) => {
        if (mounted) {
          setRoadmap(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        if (isApiError(err)) {
          setError(`${err.message} Showing fallback roadmap snapshot from February 21, 2026.`);
        } else {
          setError('Unable to load live roadmap data. Showing fallback roadmap snapshot from February 21, 2026.');
        }
        setRoadmap(ROADMAP_FALLBACK);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (!roadmap) return [];
    if (tierFilter === 'all') return roadmap.items;
    return roadmap.items.filter((item) => item.target_tier === tierFilter);
  }, [roadmap, tierFilter]);

  const groupedByTier = useMemo(() => {
    if (!roadmap) return [];
    return TIER_ORDER.map((tier) => ({
      tier,
      label: TIER_LABELS[tier],
      items: filteredItems.filter((item) => item.target_tier === tier),
    })).filter((group) => group.items.length > 0);
  }, [roadmap, filteredItems]);

  const groupedByStatus = useMemo(() => {
    return STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_TITLES[status],
      items: filteredItems.filter((item) => item.status === status),
    })).filter((group) => group.items.length > 0);
  }, [filteredItems]);

  const statusCounts = useMemo(() => {
    const counts = {
      live: 0,
      in_progress: 0,
      planned: 0,
    };
    for (const item of filteredItems) {
      if (item.status === 'live') counts.live += 1;
      if (item.status === 'in_progress') counts.in_progress += 1;
      if (item.status === 'planned' || item.status === 'removed_from_ui') counts.planned += 1;
    }
    return counts;
  }, [filteredItems]);

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return filteredItems.find((item) => item.id === selectedItemId) || null;
  }, [selectedItemId, filteredItems]);

  return (
    <section className="bg-[#060912] py-20" aria-labelledby="roadmap-heading">
      <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur">
          <h1 id="roadmap-heading" className="text-white">Product Roadmap</h1>
          <p className="mt-3 max-w-3xl text-surface-300">
            This roadmap shows what is available now and what is coming next across each plan.
            Items marked Planned are already in active delivery.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <StatBadge label="Live" value={statusCounts.live} tone="emerald" />
            <StatBadge label="In Progress" value={statusCounts.in_progress} tone="amber" />
            <StatBadge label="Planned" value={statusCounts.planned} tone="blue" />
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
              {error}
            </div>
          )}

          {roadmap && (
            <div className="mt-8 rounded-2xl border border-white/10 bg-[#0a1220]/70 p-5 text-sm text-surface-300">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-brand-400/35 bg-brand-500/15 px-3 py-1 text-xs font-semibold text-brand-100">
                  {roadmap.category}
                </span>
                <span className="text-surface-400">Version {roadmap.version}</span>
              </div>
              <p className="mt-3">{roadmap.posture}</p>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setView('timeline')}
                className={`rounded-md px-3 py-1.5 text-sm ${view === 'timeline' ? 'bg-white text-surface-950' : 'text-surface-300 hover:text-white'}`}
              >
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setView('board')}
                className={`rounded-md px-3 py-1.5 text-sm ${view === 'board' ? 'bg-white text-surface-950' : 'text-surface-300 hover:text-white'}`}
              >
                Board
              </button>
            </div>

            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as TierFilter)}
              className="w-full rounded-lg border border-white/15 bg-[#0a1220] px-3 py-2 text-sm text-surface-200 sm:w-auto"
              aria-label="Filter roadmap by plan"
            >
              <option value="all">All plans</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="team">Team</option>
              <option value="enterprise">Enterprise</option>
              <option value="multi-tier">Multi-tier</option>
            </select>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            {view === 'timeline' ? (
              <div className="relative pl-5">
                <div className="absolute left-1.5 top-0 h-full w-px bg-white/15" />
                <ul className="space-y-3">
                  {groupedByStatus.flatMap((group) =>
                    group.items.map((item) => (
                      <li key={item.id} className="relative">
                        <span className="absolute -left-5 top-4.5 h-3 w-3 rounded-full border border-white/30 bg-[#0d1626]" />
                        <button
                          type="button"
                          onClick={() => setSelectedItemId(item.id)}
                          className="w-full rounded-xl border border-white/10 bg-[#0a111b] p-3 text-left transition hover:border-white/25 hover:bg-[#0d1623]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full border px-2 py-1 text-xs font-medium ${STATUS_STYLES[item.status]}`}>
                                {STATUS_LABELS[item.status] || item.status}
                              </span>
                              <span className="text-xs text-surface-400">{TIER_LABELS[item.target_tier]}</span>
                            </div>
                          </div>
                          <h3 className="mt-2 text-sm font-semibold text-white">{item.title}</h3>
                          <p className="mt-1 text-sm text-surface-300">{item.reason}</p>
                        </button>
                      </li>
                    )),
                  )}
                </ul>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {groupedByTier.map((group) => (
                  <article key={group.tier} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <h2 className="text-base font-semibold text-white">{group.label}</h2>
                    <ul className="mt-3 space-y-2.5">
                      {group.items.map((item: MarketingRoadmapItem) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedItemId(item.id)}
                            className="w-full rounded-xl border border-white/10 bg-[#0a111b] p-3 text-left transition hover:border-white/25 hover:bg-[#0d1623]"
                          >
                            <span className={`rounded-full border px-2 py-1 text-xs font-medium ${STATUS_STYLES[item.status]}`}>
                              {STATUS_LABELS[item.status] || item.status}
                            </span>
                            <h3 className="mt-2 text-sm font-semibold text-white">{item.title}</h3>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:h-fit">
            {selectedItem ? (
              <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-5">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-base font-semibold text-white">{selectedItem.title}</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedItemId(null)}
                    className="rounded-md border border-white/20 px-2.5 py-1 text-xs text-surface-200 hover:bg-white/10"
                  >
                    Close
                  </button>
                </div>
                <p className="mt-3 text-sm text-surface-200">{selectedItem.reason}</p>
                <p className="mt-2 text-sm text-surface-300">
                  Plan: <span className="font-medium text-white">{TIER_LABELS[selectedItem.target_tier]}</span>
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="text-base font-semibold text-white">Select a milestone</h3>
                <p className="mt-2 text-sm text-surface-300">
                  Click any roadmap item to view details here.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

function StatBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'amber' | 'blue';
}) {
  const tones: Record<'emerald' | 'amber' | 'blue', string> = {
    emerald: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200',
    amber: 'border-amber-400/35 bg-amber-500/10 text-amber-200',
    blue: 'border-blue-400/35 bg-blue-500/10 text-blue-200',
  };

  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-[0.12em]">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
