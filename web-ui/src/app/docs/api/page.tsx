import type { Metadata } from 'next';
import { DocsPage, DocsBlock } from '@/components/docs/DocsPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'API Integration',
  'High-level API integration guide for customers and evaluators.',
  '/docs/api',
);

export default function DocsApiPage() {
  return (
    <DocsPage
      title="API Integration"
      summary="Use this page to integrate SkillGate API behavior into real production flows."
    >
      <DocsBlock title="What this page covers">
        <ul className="list-disc space-y-2 pl-6">
          <li>Authentication and subscription-driven access patterns.</li>
          <li>Checkout and webhook lifecycle at a product level.</li>
          <li>Integration expectations for stable production behavior.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="How payment integration works">
        <ol className="list-decimal space-y-2 pl-6">
          <li>User selects a plan in your app.</li>
          <li>Your backend starts a checkout session and redirects to Stripe hosted checkout.</li>
          <li>Stripe sends signed webhook events to SkillGate for subscription state updates.</li>
          <li>Your app reads subscription status from SkillGate to control feature access.</li>
        </ol>
      </DocsBlock>

      <DocsBlock title="Production integration requirements">
        <ul className="list-disc space-y-2 pl-6">
          <li>Billing and webhook flows should be idempotent and replay-safe.</li>
          <li>Your backend should treat webhook state as source of truth.</li>
          <li>Use stable error handling and request tracing in client apps.</li>
        </ul>
      </DocsBlock>

      <DocsBlock title="Need full API reference">
        <p>Contact support@skillgate.io to request full endpoint reference and integration support for your tier.</p>
      </DocsBlock>
    </DocsPage>
  );
}
