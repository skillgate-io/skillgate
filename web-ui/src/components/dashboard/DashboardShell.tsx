/* Dashboard shell — sidebar + topbar + content area. */
'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { Sidebar } from './Sidebar';
import { DashboardTopbar } from './DashboardTopbar';

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || user === null) return;
    if (!user.email_verified) router.replace('/verify-email');
  }, [user, loading, router]);

  return (
    <div className="flex min-h-[calc(100vh-65px)]">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <DashboardTopbar />
        <div className="flex-1 overflow-y-auto p-4 pb-20 sm:p-6 lg:pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
