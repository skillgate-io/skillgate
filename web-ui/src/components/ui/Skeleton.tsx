/* Skeleton loading placeholder. */
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-white/[0.06]',
        className,
      )}
      aria-hidden="true"
    />
  );
}
