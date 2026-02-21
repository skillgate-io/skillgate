import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Privacy Policy',
  'SkillGate privacy policy describing data collection, processing, retention, and user rights.',
  '/privacy',
);

export default function PrivacyPage() {
  return (
    <section className="bg-[#05070b] py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-surface-400">Last updated: February 21, 2026</p>
        <p className="mt-4 text-surface-300">
          This Privacy Policy describes how SkillGate processes personal data when you use our
          website, hosted APIs, and commercial support channels.
        </p>

        <div className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-surface-300 backdrop-blur">
          <section>
            <h2 className="text-white">1. Data We Process</h2>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>Account data: email, name, authentication metadata.</li>
              <li>Billing data: subscription and invoice status from Stripe (no raw card numbers).</li>
              <li>Service telemetry: API request metadata, rate-limit and error logs.</li>
              <li>Security telemetry: abuse signals, policy enforcement events, and access-control audit logs.</li>
              <li>Support data: emails and tickets sent to support or legal contacts.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white">2. Data We Do Not Intend To Collect By Default</h2>
            <p className="mt-2">
              Local skill scanning is designed to run without sending source code to SkillGate.
              If you opt into hosted features, only data required to provide those features is
              processed.
            </p>
          </section>

          <section>
            <h2 className="text-white">3. Legal Bases</h2>
            <p className="mt-2">
              We process data to perform contracts, protect service integrity, comply with legal
              obligations, and pursue legitimate interests such as abuse prevention and reliability.
            </p>
          </section>

          <section>
            <h2 className="text-white">4. Retention</h2>
            <p className="mt-2">
              We retain personal data only as long as needed for service operation, legal
              obligations, dispute resolution, abuse investigations, and security incident response.
            </p>
          </section>

          <section>
            <h2 className="text-white">5. Security and Abuse Prevention</h2>
            <p className="mt-2">
              We process relevant telemetry to detect, prevent, and respond to fraud, abuse,
              unauthorized access, safeguard circumvention, malware delivery attempts, and other
              threats to users or infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-white">6. Third Parties</h2>
            <p className="mt-2">
              We use infrastructure and payment processors to deliver the service. Stripe processes
              payment information under its own terms and privacy policy.
            </p>
          </section>

          <section>
            <h2 className="text-white">7. Legal Requests and Disclosures</h2>
            <p className="mt-2">
              We may disclose information to comply with applicable law, regulation, valid legal
              process, or to protect rights, safety, and service integrity.
            </p>
          </section>

          <section>
            <h2 className="text-white">8. Your Rights</h2>
            <p className="mt-2">
              Subject to applicable law, you may request access, correction, deletion, or export of
              your personal data, and object to or restrict certain processing.
            </p>
          </section>

          <section>
            <h2 className="text-white">9. Security</h2>
            <p className="mt-2">
              We use technical and organizational safeguards including encryption in transit,
              least-privilege access controls, and monitoring for abuse and operational anomalies.
            </p>
          </section>

          <section>
            <h2 className="text-white">10. Contact</h2>
            <p className="mt-2">
              Privacy requests: <a className="text-emerald-300 hover:text-emerald-200" href="mailto:support@skillgate.io">support@skillgate.io</a>
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
