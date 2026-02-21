/* Responsive data table — table on desktop, cards on mobile. */
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading,
  emptyMessage = 'No data to display',
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-surface-400">{emptyMessage}</p>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn('px-3 py-3 text-surface-200', col.className)}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {data.map((item) => (
          <div
            key={keyExtractor(item)}
            className="rounded-lg border border-white/10 bg-white/[0.02] p-3"
          >
            {columns.map((col) => (
              <div key={col.key} className="flex items-center justify-between py-1.5">
                <span className="text-xs font-medium text-surface-500">
                  {col.header}
                </span>
                <span className="text-sm text-surface-200">{col.render(item)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
