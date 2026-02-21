/* Progressive unlock — never grey dead cards. Shows actionable preview + upgrade CTA. */
'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { type Tier, hasTierAccess } from '@/lib/types/dashboard';

interface TierGateProps {
  requiredTier: Tier;
  featureName: string;
  children: ReactNode;
  /** Optional preview content shown when user lacks access. */
  preview?: ReactNode;
}

export function TierGate({ requiredTier, featureName, children, preview }: TierGateProps) {
  const { user } = useAuth();
  const currentTier = (user?.tier || 'free') as Tier;

  if (hasTierAccess(currentTier, requiredTier)) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {preview && (
        <div className="pointer-events-none opacity-40" aria-hidden="true">
          {preview}
        </div>
      )}
      <div className="flex flex-col items-center justify-center rounded-xl border border-brand-500/20 bg-brand-600/5 p-6 text-center">
        <p className="text-sm font-medium text-surface-200">
          {featureName} requires <span className="capitalize text-brand-400">{requiredTier}</span> plan
        </p>
        <p className="mt-1 text-xs text-surface-400">
          Upgrade to unlock this feature and get more out of SkillGate.
        </p>
        <Link
          href="/dashboard/billing"
          className="mt-3 inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          View upgrade options
        </Link>
      </div>
    </div>
  );
}
