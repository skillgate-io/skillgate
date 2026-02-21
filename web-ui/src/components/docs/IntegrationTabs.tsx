'use client';

import { useMemo, useState } from 'react';
import { CodeBlock } from '@/components/docs/DocsPage';
import { cn } from '@/lib/utils';

type IntegrationExample = {
  id: string;
  label: string;
  summary: string;
  commands: string;
  notes: readonly string[];
};

export function IntegrationTabs({ examples }: { examples: IntegrationExample[] }) {
  const [activeId, setActiveId] = useState(examples[0]?.id ?? '');

  const active = useMemo(() => {
    return examples.find((example) => example.id === activeId) ?? examples[0];
  }, [activeId, examples]);

  if (!active) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {examples.map((example) => {
          const isActive = example.id === active.id;
          return (
            <button
              key={example.id}
              type="button"
              onClick={() => setActiveId(example.id)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm transition',
                isActive
                  ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/15 bg-[#0b1322] text-surface-300 hover:border-white/30 hover:text-white',
              )}
            >
              {example.label}
            </button>
          );
        })}
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-sm text-surface-300">{active.summary}</p>
        <div className="mt-3">
          <CodeBlock code={active.commands} />
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-surface-400">
          {active.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
