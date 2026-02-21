'use client';

import { useEffect, useState } from 'react';

const THREAT_TEXT =
  '✕ cmd.exe ✕ rm -rf ✕ eval() ✕ shell exec ✕ token theft ✕ curl | bash ✕ credential dump ✕ backdoor ✕ injection ✕ exfil ✕';

function ShieldSVG({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sg-grad-stroke" x1="32" y1="2" x2="32" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id="sg-grad-inner" x1="32" y1="9" x2="32" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="sg-grad-lock" x1="32" y1="22" x2="32" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
      </defs>
      {/* Outer shield */}
      <path
        d="M32 3L59 14V36C59 52 32 69 32 69C32 69 5 52 5 36V14L32 3Z"
        stroke="url(#sg-grad-stroke)"
        strokeWidth="1.5"
        fill="rgba(9,12,19,0.88)"
      />
      {/* Inner shield fill */}
      <path
        d="M32 9L53 18.5V35C53 48 32 63 32 63C32 63 11 48 11 35V18.5L32 9Z"
        stroke="url(#sg-grad-inner)"
        strokeWidth="0.75"
        fill="url(#sg-grad-inner)"
      />
      {/* Lock shackle */}
      <path
        d="M26.5 33.5V28C26.5 23 37.5 23 37.5 28V33.5"
        stroke="url(#sg-grad-lock)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Lock body */}
      <rect x="22.5" y="33" width="19" height="13" rx="2.5" fill="url(#sg-grad-lock)" opacity="0.85" />
      {/* Keyhole */}
      <circle cx="32" cy="38.5" r="2.2" fill="rgba(9,12,19,0.8)" />
      <rect x="30.8" y="38.5" width="2.4" height="3.5" rx="1.2" fill="rgba(9,12,19,0.8)" />
      {/* SG monogram */}
      <text
        x="32"
        y="57"
        textAnchor="middle"
        fontFamily="'JetBrains Mono', 'Fira Code', monospace"
        fontSize="6.5"
        fontWeight="700"
        fill="#94a3b8"
        letterSpacing="1.5"
      >
        SG
      </text>
    </svg>
  );
}

const SHARDS = [
  { dx: '-54px', dy: '-20px', rot: '145deg',  delay: '0ms',   w: 13, h: 8  },
  { dx:  '50px', dy: '-24px', rot: '-130deg', delay: '80ms',  w: 10, h: 14 },
  { dx: '-40px', dy:  '32px', rot: '200deg',  delay: '160ms', w: 8,  h: 11 },
  { dx:  '44px', dy:  '30px', rot: '-170deg', delay: '240ms', w: 15, h: 7  },
  { dx: '-20px', dy:  '40px', rot: '240deg',  delay: '320ms', w: 7,  h: 12 },
  { dx:  '24px', dy:  '38px', rot: '-200deg', delay: '400ms', w: 10, h: 9  },
] as const;

export default function ThreatTear() {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setTimeout(() => setAnimate(true), 400);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      className="relative h-[180px] w-full overflow-hidden lg:h-[220px]"
      aria-hidden="true"
    >
      {/* Glow ring — always rendered behind shield */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 220,
          height: 220,
          background:
            'radial-gradient(circle, rgba(59,130,246,0.4) 0%, rgba(16,185,129,0.18) 45%, transparent 70%)',
          animation: animate ? 'sg-glow-pulse 3s ease-in-out 1.3s infinite' : undefined,
        }}
      />

      {/* Shield — always in DOM (barrier overlays it during animation) */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: '28%',
          zIndex: 10,
          animation: animate
            ? 'sg-shield-rise 0.55s cubic-bezier(0.34,1.56,0.64,1) 1.05s both'
            : undefined,
        }}
      >
        <ShieldSVG className="h-28 w-24 drop-shadow-[0_0_18px_rgba(59,130,246,0.55)] lg:h-36 lg:w-32" />
      </div>

      {/* Barrier panel — renders on animate, tears away via sg-tear-open */}
      {animate && (
        <div
          className="threat-barrier absolute inset-0"
          style={{
            zIndex: 20,
            background: '#0c0508',
            animation: 'sg-tear-open 0.95s cubic-bezier(0.4,0,0.2,1) 0.75s forwards',
            willChange: 'clip-path',
          }}
        >
          {/* Scrolling threat symbols — 4 rows for seamless 2-row loop */}
          <div
            className="absolute inset-x-0 top-0 select-none"
            style={{ animation: 'sg-threat-scroll 9s linear 0.75s infinite' }}
          >
            {Array.from({ length: 4 }, (_, i) => (
              <p
                key={i}
                className="py-1.5 text-center font-mono text-[10px] tracking-widest text-red-900/30"
              >
                {THREAT_TEXT}
              </p>
            ))}
          </div>
          {/* Radial vignette */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(60,0,0,0.25) 100%)',
            }}
          />
        </div>
      )}

      {/* Debris shards */}
      {animate &&
        SHARDS.map((s, i) => (
          <div
            key={i}
            className="pointer-events-none absolute"
            style={{
              zIndex: 30,
              left: '50%',
              top: '70%',
              width: s.w,
              height: s.h,
              marginLeft: -(s.w / 2),
              marginTop: -(s.h / 2),
              background: 'rgba(120,20,20,0.5)',
              clipPath:
                i % 2 === 0
                  ? 'polygon(0% 100%, 100% 60%, 80% 0%)'
                  : 'polygon(20% 0%, 100% 100%, 0% 80%)',
              // @ts-expect-error CSS custom properties on inline style
              '--dx': s.dx,
              '--dy': s.dy,
              '--rot': s.rot,
              animationName: 'sg-debris-fly',
              animationDuration: '0.7s',
              animationTimingFunction: 'ease-out',
              animationDelay: s.delay,
              animationFillMode: 'forwards',
            }}
          />
        ))}
    </div>
  );
}
