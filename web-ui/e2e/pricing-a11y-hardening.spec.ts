import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const axePath = join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js');
const axeSource = readFileSync(axePath, 'utf8');

test.describe('Pricing a11y hardening', () => {
  test('carousel supports keyboard left/right navigation', async ({ page }) => {
    await page.goto('/pricing');
    const carousel = page.getByRole('region', { name: 'Pricing categories carousel' });
    await carousel.focus();

    const staticDot = page.getByRole('button', { name: /Go to Static Governance/i });
    const runtimeDot = page.getByRole('button', { name: /Go to Runtime and Org Control Plane/i });
    await expect(staticDot).toHaveAttribute('aria-current', 'true');

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(runtimeDot).toHaveAttribute('aria-current', 'true');

    await page.keyboard.press('ArrowLeft');
    await expect(runtimeDot).not.toHaveAttribute('aria-current', 'true');
  });

  test('pricing page passes color-contrast critical/serious checks', async ({ page }) => {
    await page.goto('/pricing');
    await page.evaluate(axeSource);

    const results = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axe = (window as any).axe;
      return axe.run(document, {
        runOnly: { type: 'rule', values: ['color-contrast'] },
      });
    });

    const blocking = results.violations.filter(
      (violation: { impact: string | null }) =>
        violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(blocking).toHaveLength(0);
  });
});
