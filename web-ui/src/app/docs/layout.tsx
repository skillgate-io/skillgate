import type { ReactNode } from 'react';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { DocsToc } from '@/components/docs/DocsToc';

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-[#05070b] pb-16 pt-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(59,130,246,0.16),transparent_34%),radial-gradient(circle_at_86%_84%,rgba(16,185,129,0.12),transparent_30%)]" />
      <div className="relative mx-auto grid max-w-[1440px] gap-6 px-4 sm:px-6 md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_240px] lg:px-8">
        <DocsSidebar />
        <div>{children}</div>
        <DocsToc />
      </div>
    </div>
  );
}
