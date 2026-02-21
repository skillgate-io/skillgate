/* Dashboard layout — wraps all /dashboard/* pages with sidebar shell. */
import type { Metadata } from 'next';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export const metadata: Metadata = {
  title: 'Dashboard | SkillGate',
  description: 'Manage your scans, API keys, and subscription.',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
