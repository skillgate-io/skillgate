import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Security Addendum Template',
  'Template security addendum covering controls, incident response, and operational commitments.',
  '/legal/security-addendum-template',
);

export default function SecurityAddendumTemplatePage() {
  return (
    <section className="bg-[#05070b] py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-white">Security Addendum (Template)</h1>
        <p className="mt-3 text-surface-300">
          This template is for enterprise procurement and security review. Final terms require legal
          and security approval by both parties.
        </p>

        <div className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-surface-300 backdrop-blur">
          <section>
            <h2 className="text-white">1. Security Program</h2>
            <p className="mt-2">
              Provider maintains a risk-based information security program aligned to recognized
              frameworks and proportional to service sensitivity and threat profile.
            </p>
          </section>

          <section>
            <h2 className="text-white">2. Access Control</h2>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>Least-privilege access for production systems.</li>
              <li>MFA for privileged administrative access.</li>
              <li>Access review and revocation processes for role changes and offboarding.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white">3. Encryption</h2>
            <p className="mt-2">
              Data in transit is protected by modern TLS. Sensitive data at rest is encrypted using
              managed keying controls and restricted access.
            </p>
          </section>

          <section>
            <h2 className="text-white">4. Logging and Monitoring</h2>
            <p className="mt-2">
              Security-relevant events are logged and monitored. Alerts are triaged by an incident
              response process with defined escalation paths.
            </p>
          </section>

          <section>
            <h2 className="text-white">5. Abuse and Misuse Defense</h2>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>Controls to detect and contain unauthorized access and policy bypass attempts.</li>
              <li>Rate-limiting and abuse throttling to protect service integrity.</li>
              <li>Response playbooks for exploit, malware, or hostile automation indicators.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white">6. Vulnerability Management</h2>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>Routine patching and dependency vulnerability review.</li>
              <li>Risk-prioritized remediation SLAs by severity.</li>
              <li>Change control for security-impacting production updates.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white">7. Incident Response and Notice</h2>
            <p className="mt-2">
              Provider notifies Customer of confirmed security incidents affecting Customer data
              within
              <code className="mx-1 rounded bg-white/10 px-1 py-0.5">[X hours]</code>
              and provides updates until containment and closure.
            </p>
          </section>

          <section>
            <h2 className="text-white">8. Authorized Security Testing</h2>
            <p className="mt-2">
              Customer-led testing against Provider systems requires prior written authorization,
              approved scope, and coordinated disclosure procedures. Unauthorized penetration testing
              is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-white">9. Business Continuity and Backup</h2>
            <p className="mt-2">
              Provider maintains backup and recovery procedures, tests restoration, and documents
              material continuity dependencies.
            </p>
          </section>

          <section>
            <h2 className="text-white">10. Subprocessor Security</h2>
            <p className="mt-2">
              Provider imposes contractual security obligations on subprocessors and remains
              responsible for their performance under applicable agreements.
            </p>
          </section>

          <section>
            <h2 className="text-white">11. Audit Artifacts</h2>
            <p className="mt-2">
              Subject to confidentiality and platform safety, Provider supplies available security
              artifacts and policy summaries for Customer due diligence.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
