import { expect, test } from '@playwright/test';

interface AnalyticsEvent {
  event: string;
  label?: string;
  meta?: Record<string, string>;
}

test.describe('Pricing analytics hardening', () => {
  test('emits pricing funnel and interaction events with variant metadata', async ({ page }) => {
    const capturedEvents: AnalyticsEvent[] = [];

    await page.route('**/__analytics', async (route) => {
      const request = route.request();
      const body = request.postDataJSON() as { events?: AnalyticsEvent[] } | null;
      if (body?.events) {
        capturedEvents.push(...body.events);
      }
      await route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/pricing');

    await page.getByRole('button', { name: 'Monthly' }).click();
    await page.getByRole('button', { name: /Control stack layer Static Scan/i }).click();
    await page.getByText('Compare Plans Across the Full Control Plane').click();
    await page.getByRole('button', { name: /Go to Runtime and Org Control Plane/i }).click();
    await page.getByRole('button', { name: /Contact Sales/i }).click();

    await expect(page).toHaveURL(/\/contact\?plan=enterprise&source=pricing/);

    await expect
      .poll(
        () =>
          [
            'pricing_experiment_view',
            'pricing_interval_change',
            'control_stack_interaction',
            'pricing_matrix_expand',
            'pricing_sales_contact_click',
          ].every((eventName) => capturedEvents.some((event) => event.event === eventName)),
      )
      .toBe(true);

    const intervalEvent = capturedEvents.find((event) => event.event === 'pricing_interval_change');
    expect(intervalEvent?.meta?.pricing_variant).toBeTruthy();
    expect(intervalEvent?.meta?.pricing_variant_source).toBeTruthy();
  });
});
