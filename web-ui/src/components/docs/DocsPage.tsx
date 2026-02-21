import type { ReactNode } from 'react';

export { CodeBlock } from '@/components/docs/CodeBlock';

export function DocsPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <article
      data-docs-content
      className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] md:p-8"
    >
      <div className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
        SkillGate Docs
      </div>
      <h1 className="mt-4 text-3xl font-bold text-white md:text-4xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-surface-300">{summary}</p>
      <div className="mt-8 space-y-10 text-surface-200">{children}</div>
    </article>
  );
}

export function DocsBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const id = slugify(title);
  return (
    <section id={id} aria-label={title} className="scroll-mt-24">
      <h2 className="group flex items-center gap-2 text-xl font-semibold text-white">
        <a href={`#${id}`} className="transition hover:text-emerald-200">
          {title}
        </a>
        <a
          href={`#${id}`}
          className="opacity-0 transition group-hover:opacity-100 text-xs text-emerald-300"
          aria-label={`Link to ${title}`}
        >
          #
        </a>
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-surface-300">{children}</div>
    </section>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}
