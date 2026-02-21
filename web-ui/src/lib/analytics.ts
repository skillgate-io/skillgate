/* 16.17: Privacy-aware analytics — funnel event tracking.
 *
 * No PII collected. Events are structural (page, action, label) only.
 * Designed for Plausible/Fathom/PostHog or custom backend ingestion.
 * No cookies set by this module — privacy-safe by default.
 */

export type FunnelEvent =
  | 'page_view'
  | 'pricing_cta_click'
  | 'pricing_interval_change' // Sprint 7.2 (Task 17.45): Track monthly/yearly toggle
  | 'pricing_experiment_view'
  | 'control_stack_interaction'
  | 'pricing_matrix_expand'
  | 'pricing_matrix_link_click'
  | 'pricing_sales_contact_click'
  | 'signup_cta_click'
  | 'signup_success'
  | 'login_success'
  | 'checkout_start'
  | 'checkout_success'
  | 'checkout_cancel'
  | 'checkout_error'
  | 'docs_click'
  | 'install_platform_select'
  | 'install_channel_select'
  | 'install_copy_command'
  | 'install_docs_conversion'
  | 'github_click'
  | 'feature_section_view'
  | 'share_clicked'
  | 'invite_accepted';

export interface EventPayload {
  event: FunnelEvent;
  /** ISO timestamp */
  timestamp: string;
  /** Page path (no PII) */
  path: string;
  /** Optional label for distinguishing variants */
  label?: string;
  /** Optional metadata (tier, error type — never PII) */
  meta?: Record<string, string>;
}

/** In-memory event buffer for batch sending */
let eventBuffer: EventPayload[] = [];
const configuredFlushSize = Number(process.env.NEXT_PUBLIC_ANALYTICS_FLUSH_SIZE ?? '10');
const BUFFER_FLUSH_SIZE = Number.isFinite(configuredFlushSize) && configuredFlushSize > 0
  ? configuredFlushSize
  : 10;
const BUFFER_FLUSH_INTERVAL_MS = 30_000;

let flushTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Track a funnel event. Privacy-safe: no PII, no cookies.
 *
 * @param event - The event type
 * @param label - Optional label for variant tracking
 * @param meta - Optional non-PII metadata
 */
export function trackEvent(
  event: FunnelEvent,
  label?: string,
  meta?: Record<string, string>,
): void {
  const payload: EventPayload = {
    event,
    timestamp: new Date().toISOString(),
    path: typeof window !== 'undefined' ? window.location.pathname : '/',
    ...(label && { label }),
    ...(meta && { meta }),
  };

  eventBuffer.push(payload);

  // Auto-flush when buffer is full
  if (eventBuffer.length >= BUFFER_FLUSH_SIZE) {
    void flushEvents();
  }
}

/**
 * Flush buffered events to analytics endpoint.
 * Silently fails — analytics should never break the app.
 */
export async function flushEvents(): Promise<void> {
  if (eventBuffer.length === 0) return;

  const batch = [...eventBuffer];
  eventBuffer = [];

  try {
    // Send to analytics endpoint (configurable)
    const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    if (!endpoint) return; // No endpoint configured — skip silently

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true, // Survive page navigation
    });
  } catch {
    // Analytics failures are non-critical — never surface to user
    // Re-buffer events for next attempt (with cap to prevent memory leak)
    if (eventBuffer.length < 100) {
      eventBuffer.push(...batch);
    }
  }
}

/**
 * Initialize periodic flush timer. Call once at app mount.
 */
export function initAnalytics(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => void flushEvents(), BUFFER_FLUSH_INTERVAL_MS);

  // Flush on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => void flushEvents());
  }
}

/**
 * Get current buffer contents (for testing).
 */
export function getEventBuffer(): readonly EventPayload[] {
  return [...eventBuffer];
}

/**
 * Clear event buffer (for testing).
 */
export function clearEventBuffer(): void {
  eventBuffer = [];
}

/**
 * Tear down analytics (for testing).
 */
export function destroyAnalytics(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  eventBuffer = [];
}
