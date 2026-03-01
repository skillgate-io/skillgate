/* Pricing page — standalone pricing with FAQ */

import type { Metadata } from 'next';
import { PricingSection } from '@/components/sections/PricingSection';
import { faqJsonLd, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Pricing',
  'Choose the SkillGate plan that matches your team stage, workflow needs, and deployment model.',
  '/pricing',
);

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLd() }}
      />
      <PricingSection />

      {/* FAQ section */}
      <section className="bg-[#05070b] py-20" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
          <h2 id="faq-heading" className="text-center text-white">
            Frequently Asked Questions
          </h2>

          <div className="mx-auto mt-12 max-w-3xl divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/[0.04] px-8 py-2 backdrop-blur">
            {[
              {
                q: 'Can I try SkillGate before paying?',
                a: 'Yes. Free includes 3 scans per day and no credit card is required. Install with `pipx install skillgate` or `npx @skillgate-io/cli version` and run your first scan right away.',
              },
              {
                q: 'What happens when I exceed the Free tier limit?',
                a: 'You get a clear daily-limit message. Upgrade to Pro for unlimited scans. Your existing results stay intact.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes. Cancel auto-renew anytime in the Stripe Customer Portal. Monthly plans end at period close. Annual plans stay active through the paid term.',
              },
              {
                q: 'Do you offer annual discounts?',
                a: 'Yes. Pro and Team include annual billing at a lower effective monthly rate. Enterprise is annual and contract-based.',
              },
              {
                q: 'Is my code sent to your servers?',
                a: 'No by default. Scans run locally, and code stays local unless you explicitly use hosted API features. Private signing keys remain local.',
              },
              {
                q: 'What CI/CD systems are supported?',
                a: 'GitHub Actions (with PR blocking and SARIF), GitLab CI, and Bitbucket Pipelines are supported out of the box. Any CI that can run a Python CLI can run SkillGate.',
              },
              {
                q: 'How does the Team plan differ from Pro?',
                a: 'Pro focuses on stronger policy checks. Team adds CI blocking, PR feedback, fleet scans (`--fleet`), and shared visibility across repos.',
              },
              {
                q: 'What makes Enterprise different from Team?',
                a: 'Enterprise adds advanced production controls, private deployment options, and evidence workflows for security and compliance reviews.',
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group py-5"
              >
                <summary className="flex cursor-pointer items-center justify-between text-left font-medium text-white [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <svg
                    className="h-5 w-5 flex-shrink-0 text-surface-400 transition-transform group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="mt-3 text-surface-300">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
