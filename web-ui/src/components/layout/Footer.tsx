/* Footer with nav links, legal, and social */
import Link from 'next/link';

const DOCS_BASE_URL = (process.env.NEXT_PUBLIC_DOCS_BASE_URL || 'https://docs.skillgate.io').replace(/\/+$/, '');

const FOOTER_LINKS = {
  Product: [
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Roadmap', href: '/roadmap' },
    { label: 'Documentation', href: `${DOCS_BASE_URL}`, external: true },
    { label: 'Migrations & Changelog', href: `${DOCS_BASE_URL}/migrations`, external: true },
  ],
  Resources: [
    { label: 'GitHub', href: 'https://github.com/skillgate-io/skillgate', external: true },
    { label: 'PyPI', href: 'https://pypi.org/project/skillgate/', external: true },
    { label: 'Docker Hub', href: 'https://hub.docker.com/r/skillgate/skillgate', external: true },
    { label: 'GitHub Action', href: 'https://github.com/marketplace/actions/skillgate-scan', external: true },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Contact', href: '/contact' },
    { label: 'Legal Center', href: `${DOCS_BASE_URL}/legal`, external: true },
    { label: 'DPA Template', href: '/legal/dpa-template' },
    { label: 'Security Addendum', href: '/legal/security-addendum-template' },
  ],
} as const;

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#04060a]" role="contentinfo">
      <div className="mx-auto max-w-content px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="group relative inline-flex items-center gap-3 rounded-xl px-2 py-1.5 text-2xl font-black tracking-[0.02em]"
              aria-label="SkillGate home"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-1 rounded-2xl bg-[radial-gradient(circle_at_30%_35%,rgba(59,130,246,0.2),rgba(59,130,246,0.0)_55%),radial-gradient(circle_at_78%_70%,rgba(16,185,129,0.14),rgba(16,185,129,0.0)_55%)] opacity-80 blur-sm transition group-hover:opacity-100"
              />
              <svg viewBox="0 0 64 72" fill="none" className="h-8 w-7 flex-shrink-0 drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]" aria-hidden="true">
                <defs>
                  <linearGradient id="ftr-stroke" x1="32" y1="2" x2="32" y2="70" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <linearGradient id="ftr-inner" x1="32" y1="9" x2="32" y2="64" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#34d399" stopOpacity="0.15" />
                  </linearGradient>
                  <linearGradient id="ftr-lock" x1="32" y1="22" x2="32" y2="48" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#93c5fd" />
                    <stop offset="100%" stopColor="#6ee7b7" />
                  </linearGradient>
                </defs>
                <path d="M32 3L59 14V36C59 52 32 69 32 69C32 69 5 52 5 36V14L32 3Z" stroke="url(#ftr-stroke)" strokeWidth="1.5" fill="rgba(9,12,19,0.88)" />
                <path d="M32 9L53 18.5V35C53 48 32 63 32 63C32 63 11 48 11 35V18.5L32 9Z" stroke="url(#ftr-inner)" strokeWidth="0.75" fill="url(#ftr-inner)" />
                <path d="M26.5 33.5V28C26.5 23 37.5 23 37.5 28V33.5" stroke="url(#ftr-lock)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <rect x="22.5" y="33" width="19" height="13" rx="2.5" fill="url(#ftr-lock)" opacity="0.85" />
                <circle cx="32" cy="38.5" r="2.2" fill="rgba(9,12,19,0.8)" />
                <rect x="30.8" y="38.5" width="2.4" height="3.5" rx="1.2" fill="rgba(9,12,19,0.8)" />
                <text x="32" y="57" textAnchor="middle" fontFamily="'JetBrains Mono','Fira Code',monospace" fontSize="6.5" fontWeight="700" fill="#94a3b8" letterSpacing="1.5">SG</text>
              </svg>
              <span className="relative z-10 bg-[linear-gradient(92deg,#ffffff_5%,#cfe4ff_40%,#b7f5d8_92%)] bg-clip-text text-transparent">
                SkillGate
              </span>
            </Link>
            <p className="mt-3 text-sm text-surface-400">
              Security gates for AI agent code.
              <br />
              Block unsafe code before deployment with signed proof.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-white">{category}</h3>
              <ul className="mt-3 space-y-2" role="list">
                {links.map((link) => (
                  <li key={link.label}>
                    {'external' in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-surface-400 transition-colors hover:text-white"
                      >
                        {link.label}
                        <span className="sr-only"> (opens in new tab)</span>
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-surface-400 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 md:flex-row">
          <p className="text-sm text-surface-500">
            &copy; {new Date().getFullYear()} SkillGate. All rights reserved.
          </p>
          <div className="flex gap-4">
            <span className="text-xs text-surface-500">
              pip install skillgate
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
