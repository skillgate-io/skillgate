'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { DOCS_NAV, DOCS_SECTIONS } from '@/lib/docs-nav';
import { cn } from '@/lib/utils';

export function DocsSidebar() {
  const pathname = usePathname();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return DOCS_NAV;
    }
    return DOCS_NAV.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q)
      );
    });
  }, [query]);

  return (
    <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:sticky md:top-20">
      <label htmlFor="docs-search" className="text-xs font-semibold uppercase tracking-wide text-surface-400">
        Search docs
      </label>
      <input
        id="docs-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search pages"
        className="mt-2 w-full rounded-lg border border-white/15 bg-[#0b1322] px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500"
      />

      <nav className="mt-5" aria-label="Documentation sections">
        <ul className="space-y-5" role="list">
          {DOCS_SECTIONS.map((section) => {
            const items = filtered.filter((item) => item.section === section);
            if (items.length === 0) {
              return null;
            }
            return (
              <li key={section}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500">
                  {section}
                </p>
                <ul className="space-y-1" role="list">
                  {items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            'block rounded-lg px-3 py-2 text-sm transition',
                            active
                              ? 'bg-emerald-500/15 text-emerald-200'
                              : 'text-surface-300 hover:bg-white/10 hover:text-white',
                          )}
                          aria-current={active ? 'page' : undefined}
                        >
                          {item.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
