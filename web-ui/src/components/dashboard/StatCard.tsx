/* KPI stat card for dashboard overview. */
import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, subtext, icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/[0.03] p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-surface-400">{label}</p>
        {icon && <span className="text-surface-500">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {subtext && (
        <p className="mt-1 text-xs text-surface-400">{subtext}</p>
      )}
    </div>
  );
}
