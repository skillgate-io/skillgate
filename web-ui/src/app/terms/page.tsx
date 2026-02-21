import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Terms of Service',
  'SkillGate terms governing access, usage, billing, and legal responsibilities.',
  '/terms',
);

export default function TermsPage() {
  return (
    <section className="bg-[#05070b] py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-white">Terms of Service</h1>
        <p className="mt-2 text-sm text-surface-400">Last updated: February 21, 2026</p>
        <p className="mt-4 text-surface-300">
          These Terms govern your use of SkillGate software, hosted APIs, and associated services.
          If you use SkillGate for an organization, you represent that you are authorized to accept
          these Terms on its behalf.
        </p>

        <div className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-surface-300 backdrop-blur">
          <section>
            <h2 className="text-white">1. Accounts and Security</h2>
            <p className="mt-2">
              You are responsible for maintaining account credentials, API keys, and access controls.
              You must promptly notify us of unauthorized access or credential compromise.
            </p>
          </section>

          <section>
            <h2 className="text-white">2. Acceptable Use</h2>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>No unlawful use, abuse testing against unauthorized targets, or denial-of-service attempts.</li>
              <li>No unauthorized access, intrusion, exploit development, malware delivery, or command-and-control activity.</li>
              <li>No attempts to bypass, disable, or circumvent technical limits, safeguards, rate limits, licensing, or billing logic.</li>
              <li>No reverse engineering, scraping, or automated extraction that violates applicable law, contract, or access restrictions.</li>
              <li>No use that violates export controls, sanctions laws, or third-party rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white">3. Authorized Security Testing</h2>
            <p className="mt-2">
              Security testing is permitted only against systems you own or are expressly authorized
              to test in writing. You must comply with applicable law and responsible disclosure
              requirements.
            </p>
          </section>

          <section>
            <h2 className="text-white">4. Billing, Renewals, and Refunds</h2>
            <p className="mt-2">
              Paid plans renew automatically unless canceled. Fees are billed through Stripe.
              Refund handling, including partial refunds and disputes, follows applicable law and
              contractual commitments.
            </p>
          </section>

          <section>
            <h2 className="text-white">5. Availability and Changes</h2>
            <p className="mt-2">
              We may modify or discontinue features with reasonable notice when practicable. We may
              suspend access for abuse, legal compliance, or urgent security response.
            </p>
          </section>

          <section>
            <h2 className="text-white">6. Enforcement and Suspension</h2>
            <p className="mt-2">
              We may investigate suspected policy violations and may suspend, restrict, or terminate
              access to protect customers, platform integrity, and legal compliance. We may preserve
              and disclose relevant information when required by law or valid legal process.
            </p>
          </section>

          <section>
            <h2 className="text-white">7. Intellectual Property</h2>
            <p className="mt-2">
              SkillGate and related service materials are protected by intellectual property laws.
              You retain ownership of your code and content.
            </p>
          </section>

          <section>
            <h2 className="text-white">8. Disclaimers</h2>
            <p className="mt-2">
              SkillGate is provided on an as-available basis except as expressly stated in a signed
              agreement. Security tooling reduces risk but does not guarantee elimination of all
              vulnerabilities or legal exposure.
            </p>
          </section>

          <section>
            <h2 className="text-white">9. Limitation of Liability</h2>
            <p className="mt-2">
              To the maximum extent permitted by law, indirect, incidental, special, consequential,
              and punitive damages are excluded. Aggregate liability is limited as set out in your
              governing commercial agreement or these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-white">10. Governing Law</h2>
            <p className="mt-2">
              Unless otherwise required by law or agreed in writing, these Terms are governed by the
              laws of Delaware, excluding conflict-of-laws principles.
            </p>
          </section>

          <section>
            <h2 className="text-white">11. Contact</h2>
            <p className="mt-2">
              Legal inquiries: <a className="text-emerald-300 hover:text-emerald-200" href="mailto:support@skillgate.io">support@skillgate.io</a>
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
