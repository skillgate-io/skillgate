/* Dashboard topbar with tier badge and breadcrumb. */
'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils';

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/scans': 'Scans',
  '/dashboard/api-keys': 'API Keys',
  '/dashboard/usage': 'Usage',
  '/dashboard/billing': 'Billing',
  '/dashboard/profile': 'Profile',
};

const TIER_STYLES: Record<string, string> = {
  free: 'bg-surface-500/20 text-surface-300',
  pro: 'bg-brand-600/20 text-brand-400',
  team: 'bg-emerald-600/20 text-emerald-400',
  enterprise: 'bg-amber-600/20 text-amber-400',
};

export function DashboardTopbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const tier = user?.tier || 'free';
  const title = ROUTE_TITLES[pathname] || 'Dashboard';

  return (
    <div className="flex items-center justify-between border-b border-white/10 bg-[#05070b]/60 px-4 py-3 backdrop-blur-sm sm:px-6">
      <h1 className="text-lg font-semibold text-white">{title}</h1>

      <div className="flex items-center gap-3">
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
            TIER_STYLES[tier] || TIER_STYLES.free,
          )}
        >
          {tier}
        </span>
        <span className="hidden text-sm text-surface-400 sm:inline">
          {user?.email}
        </span>
      </div>
    </div>
  );
}
