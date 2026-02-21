import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#090c13',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background radial gradients */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 20% 20%, rgba(59,130,246,0.18) 0%, transparent 50%), ' +
              'radial-gradient(ellipse at 80% 80%, rgba(16,185,129,0.12) 0%, transparent 50%)',
          }}
        />

        {/* Barrier remnant — torn top strip */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 200,
            background: '#0c0508',
            clipPath:
              'polygon(0% 0%, 100% 0%, 100% 62%, 90% 67%, 80% 61%, 70% 69%, 60% 62%, 50% 70%, 40% 63%, 30% 71%, 20% 64%, 10% 72%, 2% 66%, 0% 68%)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 32,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              color: 'rgba(120,20,20,0.4)',
              fontFamily: 'monospace',
              fontSize: 14,
              letterSpacing: 3,
            }}
          >
            ✕ cmd.exe ✕ eval() ✕ rm -rf ✕ shell exec ✕ token theft ✕ injection ✕ exfil ✕
          </div>
        </div>

        {/* Shield glow ring */}
        <div
          style={{
            position: 'absolute',
            top: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 260,
            height: 260,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(59,130,246,0.45) 0%, rgba(16,185,129,0.2) 45%, transparent 70%)',
          }}
        />

        {/* Shield SVG */}
        <svg
          viewBox="0 0 64 72"
          width={150}
          height={170}
          style={{ position: 'absolute', top: 85, left: '50%', transform: 'translateX(-50%)' }}
          fill="none"
        >
          <path
            d="M32 3L59 14V36C59 52 32 69 32 69C32 69 5 52 5 36V14L32 3Z"
            stroke="#3b82f6"
            strokeWidth="1.5"
            fill="rgba(9,12,19,0.9)"
          />
          <path
            d="M32 9L53 18.5V35C53 48 32 63 32 63C32 63 11 48 11 35V18.5L32 9Z"
            stroke="rgba(96,165,250,0.4)"
            strokeWidth="0.75"
            fill="rgba(96,165,250,0.06)"
          />
          <path
            d="M26.5 33.5V28C26.5 23 37.5 23 37.5 28V33.5"
            stroke="#93c5fd"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <rect x="22.5" y="33" width="19" height="13" rx="2.5" fill="#93c5fd" opacity="0.85" />
          <circle cx="32" cy="38.5" r="2.2" fill="rgba(9,12,19,0.8)" />
          <rect x="30.8" y="38.5" width="2.4" height="3.5" rx="1.2" fill="rgba(9,12,19,0.8)" />
          <text
            x="32"
            y="57"
            textAnchor="middle"
            fontSize="6.5"
            fontWeight="700"
            fill="#94a3b8"
            letterSpacing="1.5"
          >
            SG
          </text>
        </svg>

        {/* Headline */}
        <div
          style={{
            position: 'absolute',
            bottom: 152,
            left: 0,
            right: 0,
            textAlign: 'center',
            padding: '0 80px',
          }}
        >
          <div
            style={{
              fontSize: 60,
              fontWeight: 800,
              color: '#f1f5f9',
              lineHeight: 1.1,
              letterSpacing: -1,
            }}
          >
            Block Unsafe Agent Skills
          </div>
          <div style={{ fontSize: 42, fontWeight: 700, color: '#34d399', marginTop: 10 }}>
            Before They Ship
          </div>
        </div>

        {/* Badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(59,130,246,0.15)',
            border: '1px solid rgba(59,130,246,0.4)',
            borderRadius: 24,
            padding: '10px 30px',
            color: '#93c5fd',
            fontSize: 20,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          SkillGate · 119 rules · 7 languages · CI/CD enforcement
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
