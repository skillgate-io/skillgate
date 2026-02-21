'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type TocItem = {
  id: string;
  title: string;
};

export function DocsToc() {
  const pathname = usePathname();
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    const timer = window.setTimeout(() => {
      const headings = Array.from(
        document.querySelectorAll<HTMLElement>('article[data-docs-content] section[id] > h2'),
      );
      const mapped = headings
        .map((heading) => {
          const section = heading.parentElement;
          if (!section?.id) {
            return null;
          }
          return { id: section.id, title: heading.innerText.replace('#', '').trim() };
        })
        .filter((item): item is TocItem => item !== null);

      setItems(mapped);
      setActiveId(mapped[0]?.id ?? '');

      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          if (visible[0]?.target instanceof HTMLElement) {
            setActiveId(visible[0].target.id);
          }
        },
        { rootMargin: '-20% 0px -60% 0px', threshold: [0.25, 0.5, 0.75] },
      );

      mapped.forEach((item) => {
        const node = document.getElementById(item.id);
        if (node) {
          observer?.observe(node);
        }
      });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [pathname]);

  const hasItems = useMemo(() => items.length > 0, [items]);
  if (!hasItems) {
    return null;
  }

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-20 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">On this page</p>
        <nav className="mt-3">
          <ul className="space-y-1" role="list">
            {items.map((item) => {
              const active = item.id === activeId;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className={cn(
                      'block rounded-md px-2 py-1.5 text-sm transition',
                      active
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : 'text-surface-400 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    {item.title}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
