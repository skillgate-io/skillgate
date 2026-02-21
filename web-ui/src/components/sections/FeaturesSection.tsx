/* Feature breakdown section — customer-facing outcomes */
'use client';

import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string[];
}

const FEATURES: Feature[] = [
  {
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    title: 'Runtime Guardrails',
    description: 'Block unsafe tool actions before agent commands run.',
    details: [
      'AI-BOM validation and output-poisoning checks',
      'Approval requirements and signed enforcement records',
      'Capability budgets for shell, network, and filesystem',
      'Predictable allow/block outcomes with machine-readable codes',
    ],
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'Trust and Blast Radius Mapping',
    description: 'See where risk can spread before one bad action turns into a larger incident.',
    details: [
      'Privilege depth and high-risk path counts',
      'Lateral movement potential and blast radius',
      'Secret exposure spread across lineage edges',
      'Signed artifact verification with consistent risk metrics',
    ],
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: 'Fleet Policy Coverage',
    description: 'Check many repos with one standard policy and clear rollout visibility.',
    details: [
      'Fleet-wide scanning with predictable bundle discovery',
      'Fail-rate thresholds for CI rollout controls',
      'Fleet baseline and drift comparison workflows',
      'Remote repository intake across major source platforms',
    ],
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
      </svg>
    ),
    title: 'Policy Rollout Simulation',
    description: 'Preview rollout impact before changing rules across live projects.',
    details: [
      'Organization-level fail-rate and noise summaries',
      'Top violations ranked for fast remediation',
      'Stable JSON outputs for dashboards',
      'Supports local and provider selectors',
    ],
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 15.75h.008v.008H12v-.008z" />
      </svg>
    ),
    title: 'Signed Intelligence Feed',
    description: 'Share trusted threat signals without slowing your delivery workflow.',
    details: [
      'Signed reputation verification and controlled submission workflows',
      'Known-safe, suspicious, and malicious verdicts',
      'Redacted hash handling in runtime policy decisions',
      'Offline-first cache integrity verification',
    ],
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
    title: 'CI Enforcement and Audit Proof',
    description: 'Keep releases safer with clear pass/fail results and shareable evidence.',
    details: [
      'Stable exit codes and policy resolution order',
      'JSON and SARIF outputs for CI and security tooling',
      'Signed scan and session artifacts for legal/audit trails',
      'Clear scoring and no hidden decision logic',
    ],
  },
];

export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);

  // 16.17: Track feature section visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          trackEvent('feature_section_view');
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="features"
      className="relative bg-[#05070b] py-20 sm:py-28"
      aria-labelledby="features-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_14%,rgba(16,185,129,0.12),transparent_35%)]" />
      <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="features-heading" className="text-white">
            Why teams pick SkillGate
          </h2>
          <p className="mt-4 text-lg text-surface-300">
            One clear workflow from scan to release, with practical controls teams can trust.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="group rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-white backdrop-blur transition duration-300 hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-emerald-300 transition-colors group-hover:bg-emerald-400/20">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-surface-300">{feature.description}</p>
              <ul className="mt-4 space-y-2" role="list">
                {feature.details.map((detail) => (
                  <li
                    key={detail}
                    className="flex items-start gap-2 text-sm text-surface-400"
                  >
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {detail}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
