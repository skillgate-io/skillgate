/** @type {import('next').NextConfig} */

// 16.13: Bundle analyzer for production hardening
const withBundleAnalyzer = process.env.ANALYZE === 'true'
  ? require('@next/bundle-analyzer')({ enabled: true })
  : (config) => config;
const isDev = process.env.NODE_ENV !== 'production';
const connectSrc = [
  "'self'",
  "https://api.skillgate.io",
  "https://api.stripe.com",
  ...(isDev ? ["http://localhost:8000", "http://127.0.0.1:8000"] : []),
].join(" ");

const nextConfig = {
  // 16.13: Route-level code splitting (automatic with App Router)
  // 16.13: Compress via Brotli/Gzip (handled by CDN/Vercel)

  // 16.15: Security headers
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        // 16.15: HSTS — force HTTPS
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        // 16.15: Prevent clickjacking
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        // 16.15: XSS protection
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        // 16.15: Referrer policy — privacy-safe
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        // 16.15: Permissions policy — restrict browser features
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
        },
        // 16.15: Strict CSP
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://js.stripe.com`,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            `connect-src ${connectSrc}`,
            "frame-src https://js.stripe.com https://hooks.stripe.com",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
          ].join('; '),
        },
      ],
    },
  ],

  redirects: async () => [
    {
      source: '/docs',
      destination: '/docs/skillgate',
      permanent: true,
    },
    {
      source: '/docs/cli',
      destination: '/docs/skillgate/commands',
      permanent: true,
    },
    {
      source: '/docs/agent-gateway',
      destination: '/docs/skillgate/runtime-integrations',
      permanent: true,
    },
  ],

  // 16.13: Webpack optimizations
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Tree-shake unused icons/components
      config.resolve.fallback = { fs: false, path: false };
    }
    return config;
  },

  // Trailing slashes for consistent routing
  trailingSlash: false,

  // Powered-by header disabled for security
  poweredByHeader: false,
};

module.exports = withBundleAnalyzer(nextConfig);
