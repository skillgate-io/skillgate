/* 16.16: Centralized SEO metadata configuration.
 *
 * OpenGraph, Twitter Cards, canonical tags, structured data.
 * Used by layout.tsx and per-page metadata exports.
 */

import type { Metadata } from 'next';

const SITE_URL = 'https://skillgate.io';
const SITE_NAME = 'SkillGate';
const SITE_DESCRIPTION =
  'Block unsafe agent code before deployment with deterministic policy gates, runtime controls, and signed evidence.';

/** Default metadata applied to all pages */
export const defaultMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'SkillGate | Agent Skill Security Governance',
    template: '%s | SkillGate',
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'agent security',
    'skill governance',
    'CI/CD policy',
    'static analysis',
    'code scanning',
    'SARIF',
    'signed attestations',
    'Ed25519',
    'GitHub Actions',
    'AI agent governance',
    'OpenClaw',
    'MCP security',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,

  // 16.16: OpenGraph
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'SkillGate | Agent Skill Security Governance',
    description: SITE_DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/og`,
        width: 1200,
        height: 630,
        alt: 'SkillGate | Block unsafe agent skills in CI',
      },
    ],
  },

  // 16.16: Twitter Cards
  twitter: {
    card: 'summary_large_image',
    title: 'SkillGate | Agent Skill Security Governance',
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og`],
  },

  // 16.16: Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // 16.16: Canonical
  alternates: {
    canonical: SITE_URL,
  },

  // Verification (populate when accounts are set up)
  // verification: {
  //   google: 'your-google-verification-code',
  // },
};

/** Page-specific metadata factory */
export function pageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}${path}`,
    },
    openGraph: {
      title: `${title} | SkillGate`,
      description,
      url: `${SITE_URL}${path}`,
    },
    twitter: {
      title: `${title} | SkillGate`,
      description,
    },
  };
}

/**
 * 16.16: Structured data (JSON-LD) for SoftwareApplication schema.
 */
export function softwareApplicationJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SkillGate',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Cross-platform',
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    offers: [
      {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        name: 'Free',
        description: '3 scans/day, basic risk score',
      },
      {
        '@type': 'Offer',
        price: '49',
        priceCurrency: 'USD',
        name: 'Pro',
        description: 'Unlimited scans, policy customization, signed reports',
      },
      {
        '@type': 'Offer',
        price: '99',
        priceCurrency: 'USD',
        name: 'Team',
        description: 'CI integration, PR blocking, central dashboard',
      },
    ],
  });
}

/**
 * 16.16: FAQ structured data for rich snippets.
 */
export function faqJsonLd(): string {
  const faqs = [
    {
      question: 'What is SkillGate?',
      answer:
        'SkillGate is a CLI-first security gate for AI agent code. It scans risks and blocks unsafe changes before deployment.',
    },
    {
      question: 'Which languages does SkillGate support?',
      answer:
        'SkillGate supports 7 languages: Python, JavaScript, TypeScript, Shell/Bash, Go, Rust, and Ruby, with 119 detection rules.',
    },
    {
      question: 'Does SkillGate execute my code?',
      answer:
        'No. SkillGate uses static analysis with AST parsing and regex patterns. Your code is never executed and never leaves your environment.',
    },
    {
      question: 'How does SkillGate integrate with CI/CD?',
      answer:
        'SkillGate provides integrations for GitHub Actions, GitLab CI, and Bitbucket Pipelines. It can block PRs on policy failures and upload SARIF to GitHub Security.',
    },
    {
      question: 'What are signed attestations?',
      answer:
        'SkillGate generates Ed25519-signed reports that cryptographically prove scan results haven\'t been tampered with. Verify with `skillgate verify`.',
    },
  ];

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  });
}
