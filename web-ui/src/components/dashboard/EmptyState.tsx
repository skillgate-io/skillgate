/* Empty state display for dashboard sections. */
import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 text-surface-500">{icon}</div>
      )}
      <h3 className="text-base font-semibold text-surface-200">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-surface-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
