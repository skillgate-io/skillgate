import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Incident Notice Template',
  'Enterprise incident notice template for confirmed security incidents affecting customer data.',
  '/legal/incident-notice-template',
);

export default function IncidentNoticeTemplatePage() {
  return (
    <section className="bg-[#05070b] py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-white">Incident Notice Template</h1>
        <p className="mt-3 text-surface-300">
          This template standardizes incident communication for enterprise customers. It is provided
          to improve response consistency and speed during active incident handling.
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-surface-300 backdrop-blur">
          <h2 className="text-white">Template</h2>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-[#090d15] p-4 text-sm leading-relaxed text-surface-200">
            <code>{`Subject: Security Incident Notice – [Incident ID]

Date/Time (UTC): [YYYY-MM-DD HH:MM UTC]
Incident Status: [Investigating | Identified | Contained | Resolved]
Severity: [High | Medium | Low]

Summary
- We identified a security incident affecting [service/system].
- The incident was detected on [timestamp].
- Current status: [status].

Scope
- Affected customer(s): [single customer / subset / all]
- Affected data categories: [account metadata / billing metadata / logs / none confirmed]
- Time window of potential exposure: [start-end]

What We Know
- [Fact 1]
- [Fact 2]
- [Fact 3]

What We Are Doing
- Containment actions: [actions]
- Investigation actions: [actions]
- Remediation actions: [actions]

Customer Actions (if any)
- [Action 1]
- [Action 2]

Next Update
- We will provide the next update by [timestamp].

Contact
- Incident Response: support@skillgate.io
- Legal/Compliance: support@skillgate.io`}</code>
          </pre>

          <div className="mt-6 rounded-xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            Use only for confirmed incidents. Avoid speculative statements, root-cause claims, or
            impact conclusions until validated by the incident response lead.
          </div>
        </div>
      </div>
    </section>
  );
}
