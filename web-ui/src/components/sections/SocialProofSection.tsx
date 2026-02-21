/* Social proof section — stats and trust signals */
export function SocialProofSection() {
  const stats = [
    { value: '119', label: 'Security Checks' },
    { value: '7', label: 'Languages Supported' },
    { value: '<3s', label: 'Scan Time (10 files)' },
    { value: '0', label: 'Code Run During Scan' },
  ];
  const proofPoints = [
    'Built for modern engineering teams',
    'Clear evidence you can share with stakeholders',
    'Consistent pass/fail outcomes in CI',
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
      </div>
    </section>
  );
}
