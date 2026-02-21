/* Reusable dashboard card with glass-morphism styling. */
import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function Card({ title, description, children, className, action }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/[0.03] p-5',
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-white">{title}</h3>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-surface-400">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
