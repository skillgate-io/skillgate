/* TanStack React Query provider — shared query client for the app. */
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale-while-revalidate: serve cached data instantly, refetch in background
            staleTime: 5 * 60 * 1000, // 5 min — user profile won't change often
            gcTime: 30 * 60 * 1000, // 30 min garbage collection
            refetchOnWindowFocus: false, // Don't refetch on every tab switch (saves egress)
            retry: 1, // One retry for transient failures
            refetchOnReconnect: true,
          },
          mutations: {
            retry: 0, // No retry on mutations (auth actions)
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
