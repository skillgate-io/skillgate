/* Social proof section — stats and trust signals */
import Image from 'next/image';

export function SocialProofSection() {
  const stats = [
    { value: '120', label: 'Security Checks' },
    { value: '7', label: 'Attack Surfaces Governed' },
    { value: '≤20ms', label: 'Sidecar P95 Target' },
    { value: '≤30ms', label: 'Codex Bridge P95 Target' },
  ];
  const proofPoints = [
    'Blocks risky actions before local and CI execution',
    'Protects Claude and MCP tool workflows with trust checks',
    'Secures Codex runs with safe defaults and provider controls',
  ];
  const testbedStats = [
    { label: 'Total testbed corpus', value: '3,470 invocations' },
    { label: 'awesome-llm-apps corpus', value: '496 invocations' },
    { label: 'antigravity corpus', value: '2,856 invocations' },
    { label: 'openclaw corpus', value: '106 invocations' },
    { label: 'nanobot corpus', value: '12 invocations' },
    { label: 'Authenticated sidecar replay', value: '1,735 baseline invocations' },
  ];
  const evidenceCards = [
    {
      src: '/images/testbed-evidence/awesome-proof-card.svg',
      alt: 'SkillGate testbed proof card for shubhamsaboo awesome-llm-apps corpus replay',
      label: 'awesome-llm-apps',
    },
    {
      src: '/images/testbed-evidence/antigravity-proof-card.svg',
      alt: 'SkillGate testbed proof card for sickn33 antigravity-awesome-skills corpus replay',
      label: 'antigravity',
    },
    {
      src: '/images/testbed-evidence/openclaw-proof-card.svg',
      alt: 'SkillGate testbed proof card for openclaw skills corpus replay',
      label: 'openclaw',
    },
    {
      src: '/images/testbed-evidence/nanobot-proof-card.svg',
      alt: 'SkillGate testbed proof card for HKUDS nanobot skills corpus replay',
      label: 'nanobot',
    },
    {
      src: '/images/testbed-evidence/testbed-corpus-comparison.svg',
      alt: 'SkillGate corpus size comparison across all capability testbed repositories',
      label: 'corpus comparison',
    },
  ];

  return (
    <section
      className="relative border-y border-white/10 bg-[#080b12] py-14"
      aria-label="Product statistics"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_50%,rgba(76,110,245,0.2),transparent_35%)]" />
      <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center backdrop-blur"
            >
              <div className="text-3xl font-bold text-emerald-300 sm:text-4xl">
                {stat.value}
              </div>
              <div className="mt-1 text-sm font-medium text-surface-300">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {proofPoints.map((point) => (
            <p
              key={point}
              className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200"
            >
              {point}
            </p>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-lg font-semibold text-white">Testbed Evidence</h3>
          <p className="mt-2 text-sm text-surface-300">
            Generated from public agent repositories and replayed with authenticated SkillGate sidecar enforcement.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {testbedStats.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/10 bg-[#0b1322] p-3"
              >
                <p className="text-xs uppercase tracking-[0.08em] text-surface-400">{item.label}</p>
                <p className="mt-1 text-base font-semibold text-emerald-300">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
            {evidenceCards.map((card) => (
              <div
                key={card.label}
                className="min-w-[320px] max-w-[580px] flex-none snap-start"
              >
                <Image
                  src={card.src}
                  alt={card.alt}
                  width={1280}
                  height={720}
                  className="w-full rounded-xl border border-white/10 bg-[#05070b]"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
