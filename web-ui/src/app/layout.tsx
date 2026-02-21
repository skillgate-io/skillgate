/* Root layout — applies to all pages.
 *
 * 16.12: Site structure, fonts, global providers
 * 16.14: Error boundaries
 * 16.15: Security headers (via next.config.js)
 * 16.16: SEO metadata
 * 16.17: Analytics provider
 * 16.18: Skip-to-content, landmarks
 */

import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ErrorBoundary } from '@/components/providers/ErrorBoundary';
import { AnalyticsProvider } from '@/components/providers/AnalyticsProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { defaultMetadata, softwareApplicationJsonLd } from '@/lib/seo';
import '@/styles/globals.css';

export const metadata: Metadata = defaultMetadata;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* 16.13: Preconnect to critical origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* 16.13: DNS prefetch for API */}
        <link rel="dns-prefetch" href="https://api.skillgate.io" />

        {/* 16.16: Structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: softwareApplicationJsonLd() }}
        />
      </head>
      <body className="flex min-h-screen flex-col bg-[#04060a] text-surface-100">
        {/* 16.18: Skip to main content link */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        <ErrorBoundary>
          <QueryProvider>
            <AuthProvider>
              <AnalyticsProvider>
              <Header />
              <main id="main-content" className="flex-1" role="main">
                {children}
              </main>
              <Footer />
              </AnalyticsProvider>
            </AuthProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
