import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Subprocessors',
  'Current list of subprocessors used to deliver SkillGate services and related data-processing scope.',
  '/legal/subprocessors',
);

export default function SubprocessorsPage() {
  return (
    <section className="bg-[#05070b] py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-white">Subprocessors</h1>
        <p className="mt-3 text-surface-300">
          This page lists key subprocessors used for hosted service delivery. This list is provided
          for enterprise procurement and privacy review and may be updated as infrastructure evolves.
        </p>
        <p className="mt-2 text-sm text-surface-400">Last updated: February 16, 2026</p>

        <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.05]">
                <th className="px-4 py-3 text-left font-semibold text-surface-200" scope="col">
                  Subprocessor
                </th>
                <th className="px-4 py-3 text-left font-semibold text-surface-200" scope="col">
                  Purpose
                </th>
                <th className="px-4 py-3 text-left font-semibold text-surface-200" scope="col">
                  Data Categories
                </th>
                <th className="px-4 py-3 text-left font-semibold text-surface-200" scope="col">
                  Region
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-surface-300">
              <tr>
                <td className="px-4 py-3">Stripe, Inc.</td>
                <td className="px-4 py-3">Subscription billing and payment processing</td>
                <td className="px-4 py-3">Billing identifiers, subscription status, invoice metadata</td>
                <td className="px-4 py-3">US / Global</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Cloud Hosting Provider</td>
                <td className="px-4 py-3">Compute, storage, and network infrastructure</td>
                <td className="px-4 py-3">Account and service metadata, encrypted persisted records</td>
                <td className="px-4 py-3">US / Configurable</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Transactional Email Provider</td>
                <td className="px-4 py-3">Account and operational email delivery</td>
                <td className="px-4 py-3">Email address, notification payload metadata</td>
                <td className="px-4 py-3">US / EU</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-surface-300 backdrop-blur">
          <h2 className="text-white">Change Notifications</h2>
          <p className="mt-2">
            Enterprise customers may request subprocessor change notices through their contractual
            notification channel. For questions, contact
            <a className="ml-1 text-emerald-300 hover:text-emerald-200" href="mailto:support@skillgate.io">
              support@skillgate.io
            </a>.
          </p>
        </div>
      </div>
    </section>
  );
}
