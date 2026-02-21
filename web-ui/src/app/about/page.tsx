import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'About',
  'Learn about SkillGate, our mission, and how we help teams ship safer AI agent workflows.',
  '/about',
);

export default function AboutPage() {
  return (
    <section className="bg-[#05070b] py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-white">About SkillGate</h1>
        <p className="mt-4 text-lg text-surface-300">
          SkillGate exists to make agentic software delivery safer without slowing teams down.
          We focus on clear checks, practical guardrails, and evidence teams can trust.
        </p>

        <div className="mt-10 space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-surface-300 backdrop-blur">
          <div>
            <h2 className="text-white">What We Build</h2>
            <p className="mt-2">
              We build CLI-first tooling and optional hosted services that help engineering teams
              detect risky agent-skill patterns before merge or deployment.
            </p>
          </div>
          <div>
            <h2 className="text-white">How We Work</h2>
            <p className="mt-2">
              We prioritize clear contracts, reproducible behavior, and explicit failure modes.
              We avoid hidden scoring models, vague risk language, and opaque gating logic.
            </p>
          </div>
          <div>
            <h2 className="text-white">Trust Principles</h2>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>Static analysis only. Skill code is not executed by the scanner.</li>
              <li>Local-first defaults. Data stays local unless hosted features are explicitly used.</li>
              <li>Cryptographic integrity. Signed artifacts are verifiable.</li>
              <li>Operational transparency. Incidents and material changes are communicated promptly.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
