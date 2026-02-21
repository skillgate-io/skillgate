import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Contact',
  'Contact SkillGate support, security, legal, or enterprise sales.',
  '/contact',
);

interface ContactPageProps {
  searchParams?: {
    plan?: string;
    source?: string;
  };
}

export default function ContactPage({ searchParams }: ContactPageProps) {
  const isEnterpriseInquiry = searchParams?.plan === 'enterprise';
  return (
    <section className="bg-[#05070b] py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-white">Contact</h1>
        <p className="mt-4 text-surface-300">
          Reach the right team directly. Tell us what you need and we will route your request fast.
        </p>

        {isEnterpriseInquiry && (
          <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 backdrop-blur">
            <h2 className="text-white">Enterprise Inquiry</h2>
            <p className="mt-2 text-surface-200">
              Share a few details and start your enterprise onboarding flow.
            </p>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" action="/signup" method="get">
              <input type="hidden" name="plan" value="enterprise" />
              <input type="hidden" name="source" value="contact" />
              <input
                type="text"
                name="company"
                placeholder="Company name"
                required
                className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-surface-500"
              />
              <input
                type="number"
                name="seats"
                placeholder="Estimated seats"
                min={1}
                className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-surface-500"
              />
              <input
                type="text"
                name="timeline"
                placeholder="Timeline (for example: this quarter)"
                className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-surface-500 sm:col-span-2"
              />
              <textarea
                name="requirements"
                placeholder="Security/compliance requirements"
                rows={3}
                className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-surface-500 sm:col-span-2"
              />
              <button
                type="submit"
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-surface-950 hover:bg-surface-100 sm:col-span-2 sm:w-fit"
              >
                Continue to Enterprise Setup
              </button>
            </form>
            <p className="mt-3 text-xs text-surface-300">
              Prefer email? <a className="text-emerald-300 hover:text-emerald-200" href="mailto:contact@skillgate.io?subject=Enterprise%20Plan%20Inquiry">contact@skillgate.io</a>
            </p>
          </div>
        )}

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
            <h2 className="text-white">Support</h2>
            <p className="mt-2 text-surface-300">Product and integration support for customers.</p>
            <a className="mt-4 inline-block text-emerald-300 hover:text-emerald-200" href="mailto:support@skillgate.io">
              support@skillgate.io
            </a>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
            <h2 className="text-white">Security</h2>
            <p className="mt-2 text-surface-300">Report vulnerabilities or suspected abuse.</p>
            <a className="mt-4 inline-block text-emerald-300 hover:text-emerald-200" href="mailto:support@skillgate.io">
              support@skillgate.io
            </a>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
            <h2 className="text-white">Privacy</h2>
            <p className="mt-2 text-surface-300">Data requests, privacy rights, and policy inquiries.</p>
            <a className="mt-4 inline-block text-emerald-300 hover:text-emerald-200" href="mailto:support@skillgate.io">
              support@skillgate.io
            </a>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
            <h2 className="text-white">Legal</h2>
            <p className="mt-2 text-surface-300">Contracts, terms, enterprise legal review, and notices.</p>
            <a className="mt-4 inline-block text-emerald-300 hover:text-emerald-200" href="mailto:support@skillgate.io">
              support@skillgate.io
            </a>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-surface-300 backdrop-blur">
          <h2 className="text-white">Enterprise Legal Templates</h2>
          <p className="mt-2">
            For procurement acceleration, start with our template pages:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              <a className="text-emerald-300 hover:text-emerald-200" href="/legal/dpa-template">
                Data Processing Addendum (Template)
              </a>
            </li>
            <li>
              <a className="text-emerald-300 hover:text-emerald-200" href="/legal/security-addendum-template">
                Security Addendum (Template)
              </a>
            </li>
            <li>
              <a className="text-emerald-300 hover:text-emerald-200" href="/legal/subprocessors">
                Subprocessors
              </a>
            </li>
            <li>
              <a className="text-emerald-300 hover:text-emerald-200" href="/legal/incident-notice-template">
                Incident Notice Template
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
