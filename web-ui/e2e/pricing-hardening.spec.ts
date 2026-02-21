import { expect, test } from '@playwright/test';

test.describe('Pricing hardening visual contracts', () => {
  test('desktop slide layout keeps tier balance and enterprise width', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only visual contract');

    await page.goto('/pricing');
    const pricingSection = page.locator('#pricing');
    await expect(pricingSection).toBeVisible();

    const staticDot = page.getByRole('button', { name: /Go to Static Governance/i });
    await staticDot.click();
    const freeCard = page.getByRole('heading', { name: 'Free', exact: true }).locator('..');
    const proCard = page.getByRole('heading', { name: 'Pro', exact: true }).locator('..');
    const freeBox = await freeCard.boundingBox();
    const proBox = await proCard.boundingBox();
    expect(freeBox?.width).toBeTruthy();
    expect(proBox?.width).toBeTruthy();
    if (freeBox && proBox) {
      expect(Math.abs(freeBox.width - proBox.width)).toBeLessThan(120);
    }

    await page.getByRole('button', { name: /Go to Runtime and Org Control Plane/i }).click();
    const enterpriseCard = page.getByRole('heading', { name: 'Enterprise', exact: true }).locator('..');
    const enterpriseBox = await enterpriseCard.boundingBox();
    expect(enterpriseBox?.width).toBeGreaterThan(500);

    await expect(pricingSection).toHaveScreenshot('pricing-desktop-runtime.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.02,
    });

    await testInfo.attach('pricing-desktop-runtime', {
      body: await pricingSection.screenshot(),
      contentType: 'image/png',
    });
  });

  test('mobile keeps swipe peek affordance', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile-only visual contract');

    await page.goto('/pricing');
    const carousel = page.getByRole('region', { name: 'Pricing categories carousel' });
    await expect(carousel).toBeVisible();

    const firstSlide = carousel.locator('section').first();
    const firstSlideBox = await firstSlide.boundingBox();
    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();
    if (firstSlideBox && viewport) {
      expect(firstSlideBox.width).toBeLessThan(viewport.width);
      expect(firstSlideBox.width).toBeGreaterThan(viewport.width * 0.55);
    }

    await expect(carousel).toHaveScreenshot('pricing-mobile-peek.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.03,
    });

    await testInfo.attach('pricing-mobile-peek', {
      body: await carousel.screenshot(),
      contentType: 'image/png',
    });
  });
});
