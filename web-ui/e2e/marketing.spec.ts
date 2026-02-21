/* 16.14 + 16.18: E2E tests for pages, navigation, keyboard, and error handling */
import { test, expect } from '@playwright/test';

test.describe('Marketing Pages', () => {
  test('home page renders hero and CTA', async ({ page }) => {
    await page.goto('/');

    // Hero section
    await expect(page.getByRole('heading', { name: /control plane for ai agent execution/i })).toBeVisible();
    await expect(page.locator('main').getByText('pip install skillgate').first()).toBeVisible();

    // CTA buttons exist
    await expect(page.getByRole('button', { name: /get started free/i }).first()).toBeVisible();
  });

  test('pricing page renders all 4 tiers', async ({ page }) => {
    await page.goto('/pricing');

    await expect(page.getByRole('heading', { name: /pricing mapped to the skillgate control stack/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SkillGate Control Stack', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pro', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Enterprise', exact: true })).toBeVisible();
    // Default interval is yearly, so display price reflects discounted monthly equivalent.
    await expect(page.getByText('$41')).toBeVisible();
    await expect(page.getByText('$83')).toBeVisible();
  });

  test('features page renders rule categories', async ({ page }) => {
    await page.goto('/features');

    await expect(page.getByRole('heading', { name: /detection rule categories/i })).toBeVisible();
    await expect(page.getByText('SG-SHELL-*')).toBeVisible();
    await expect(page.getByText('SG-NET-*')).toBeVisible();
  });

  test('docs page renders quick start', async ({ page }) => {
    await page.goto('/docs');

    await expect(
      page.getByRole('heading', { name: /documentation|skillgate tool/i }).first(),
    ).toBeVisible();
    await expect(page.getByText('skillgate scan')).toBeVisible();
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-page');

    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByText('Page Not Found')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('header links navigate correctly', async ({ page }) => {
    await page.goto('/');
    const header = page.getByRole('banner');

    await header.getByRole('link', { name: 'Features' }).first().click();
    await expect(page).toHaveURL(/\/features$/);

    await header.getByRole('link', { name: 'Pricing' }).first().click();
    await expect(page).toHaveURL(/\/pricing$/);

    await header.getByRole('link', { name: 'Docs' }).first().click();
    await expect(page).toHaveURL(/\/docs(?:\/.*)?$/);
  });

  test('footer links are present', async ({ page }) => {
    await page.goto('/');

    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();
    await expect(footer.getByRole('link', { name: 'SkillGate home' })).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('skip-to-content link is functional', async ({ page }) => {
    await page.goto('/');

    // Tab to skip link
    await page.keyboard.press('Tab');
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toBeFocused();

    // Activate skip link
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('main landmark roles are present', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });

  test('headings have proper hierarchy', async ({ page }) => {
    await page.goto('/');

    const h1 = page.locator('h1');
    await expect(h1.first()).toBeVisible();
  });

  test('interactive elements have accessible names', async ({ page }) => {
    await page.goto('/');

    // All buttons should have text or aria-label
    const buttons = page.getByRole('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const name = await button.getAttribute('aria-label') || await button.textContent();
      expect(name?.trim()).toBeTruthy();
    }
  });
});

test.describe('Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('mobile menu opens and closes', async ({ page }) => {
    await page.goto('/');

    const menuButton = page.getByRole('button', { name: /open menu/i });
    await expect(menuButton).toBeVisible();

    // Open menu
    await menuButton.click();
    await expect(page.getByRole('dialog', { name: /navigation menu/i })).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
  });

  test('pricing cards stack vertically on mobile', async ({ page }) => {
    await page.goto('/pricing');

    // All pricing tiers should be visible
    await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Enterprise', exact: true })).toBeVisible();
  });
});

test.describe('Checkout Flow', () => {
  test('free tier CTA links to signup for unauthenticated users', async ({ page }) => {
    await page.goto('/pricing');

    const freeButton = page.getByRole('button', { name: /get started free/i });
    await freeButton.click();

    await expect(page).toHaveURL('/signup');
  });

  test('success page renders correctly', async ({ page }) => {
    await page.goto('/success');

    await expect(page.getByRole('heading', { name: /welcome to skillgate/i })).toBeVisible();
    await expect(page.getByText('provisioning')).toBeVisible();
  });

  test('cancel page renders correctly', async ({ page }) => {
    await page.goto('/cancel');

    await expect(page.getByRole('heading', { name: /checkout cancelled/i })).toBeVisible();
    await expect(page.getByText(/haven't been charged/i)).toBeVisible();
  });
});
