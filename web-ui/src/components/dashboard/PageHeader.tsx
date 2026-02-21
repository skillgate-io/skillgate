/* Dashboard page header with optional action. */
import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-surface-400">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
