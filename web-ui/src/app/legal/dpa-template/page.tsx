import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'DPA Template',
  'Template Data Processing Addendum for enterprise procurement and privacy review.',
  '/legal/dpa-template',
);

export default function DpaTemplatePage() {
  return (
    <section className="bg-[#05070b] py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-white">Data Processing Addendum (Template)</h1>
        <p className="mt-3 text-surface-300">
          This template supports enterprise legal review. It must be adapted by counsel before
          execution. It is not legal advice.
        </p>

        <div className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-surface-300 backdrop-blur">
          <section>
            <h2 className="text-white">1. Parties and Scope</h2>
            <p className="mt-2">
              This DPA forms part of the commercial agreement between
              <code className="mx-1 rounded bg-white/10 px-1 py-0.5">[Customer Legal Name]</code>
              and
              <code className="mx-1 rounded bg-white/10 px-1 py-0.5">[SkillGate Entity Name]</code>
              for processing personal data in connection with the services.
            </p>
          </section>

          <section>
            <h2 className="text-white">2. Roles</h2>
            <p className="mt-2">
              Customer acts as Controller (or Business), and SkillGate acts as Processor (or Service
              Provider), unless otherwise stated in writing for specific workflows.
            </p>
          </section>

          <section>
            <h2 className="text-white">3. Processing Details (Annex I)</h2>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>Categories of data subjects: end users, employees, contractors, admins.</li>
              <li>Categories of personal data: account identifiers, support communications, billing metadata.</li>
              <li>Purpose: service delivery, security operations, support, billing, legal compliance.</li>
              <li>Duration: term of service plus defined retention periods.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white">4. Processor Obligations</h2>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>Process personal data only on documented instructions.</li>
              <li>Ensure confidentiality and role-based access controls.</li>
              <li>Implement appropriate technical and organizational measures.</li>
              <li>Assist with data subject rights requests where applicable.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white">5. Security Misuse Monitoring</h2>
            <p className="mt-2">
              Processor may process security telemetry required to detect and prevent unauthorized
              access, exploit attempts, safeguard circumvention, and abuse of the services, as part
              of legitimate security operations and legal compliance.
            </p>
          </section>

          <section>
            <h2 className="text-white">6. Subprocessors</h2>
            <p className="mt-2">
              Processor may engage subprocessors listed in
              <code className="mx-1 rounded bg-white/10 px-1 py-0.5">[Subprocessor Schedule]</code>.
              Material changes require prior notice per agreed notice period.
            </p>
          </section>

          <section>
            <h2 className="text-white">7. International Transfers</h2>
            <p className="mt-2">
              Where required, parties adopt Standard Contractual Clauses and supplementary measures
              for restricted transfers.
            </p>
          </section>

          <section>
            <h2 className="text-white">8. Security Incident Notification</h2>
            <p className="mt-2">
              Processor will notify Controller without undue delay after confirming a personal data
              breach affecting Customer data, including known scope, affected systems, and mitigation.
            </p>
          </section>

          <section>
            <h2 className="text-white">9. Audits and Evidence</h2>
            <p className="mt-2">
              Subject to confidentiality and security controls, Processor provides reasonable evidence
              of compliance and supports audits under mutually agreed scope and frequency limits.
            </p>
          </section>

          <section>
            <h2 className="text-white">10. Return or Deletion</h2>
            <p className="mt-2">
              On termination, Processor returns or deletes personal data per contract and legal
              retention requirements.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
