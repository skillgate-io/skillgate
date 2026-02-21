import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsPage, DocsBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Enterprise',
  'Enterprise onboarding path for security, legal, and procurement teams.',
  '/docs/enterprise',
);

export default function DocsEnterprisePage() {
  return (
    <DocsPage
      title="Enterprise"
      summary="Enterprise hub for security review, compliance evidence, deployment, and procurement workflow."
    >
      <DocsBlock title="Enterprise sections">
        <div className="grid gap-3 md:grid-cols-2">
          <Link
            href="/docs/enterprise/security"
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25 hover:bg-white/[0.05]"
          >
            <p className="text-sm font-semibold text-emerald-300">Enterprise Security</p>
            <p className="mt-1 text-sm text-surface-400">Threat model, controls, identity, and incident readiness.</p>
          </Link>
          <Link
            href="/docs/enterprise/compliance"
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25 hover:bg-white/[0.05]"
          >
            <p className="text-sm font-semibold text-emerald-300">Enterprise Compliance</p>
            <p className="mt-1 text-sm text-surface-400">EU AI Act, AI-BOM evidence, and audit output workflows.</p>
          </Link>
          <Link
            href="/docs/enterprise/deployment"
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25 hover:bg-white/[0.05]"
          >
            <p className="text-sm font-semibold text-emerald-300">Enterprise Deployment</p>
            <p className="mt-1 text-sm text-surface-400">SaaS, private relay, air-gap, and rollout recommendations.</p>
          </Link>
          <Link
            href="/docs/enterprise/procurement"
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25 hover:bg-white/[0.05]"
          >
            <p className="text-sm font-semibold text-emerald-300">Enterprise Procurement</p>
            <p className="mt-1 text-sm text-surface-400">Commercial checklist, legal review path, and onboarding.</p>
          </Link>
        </div>
      </DocsBlock>
    </DocsPage>
  );
}
