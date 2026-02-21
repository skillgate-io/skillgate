import { expect, test } from '@playwright/test';

test.describe('Docs platform', () => {
  test('docs overview and sidebar search work', async ({ page }) => {
    await page.goto('/docs');
    await expect(
      page.getByRole('heading', { name: /documentation|skillgate tool/i }).first(),
    ).toBeVisible();

    const search = page.getByLabel('Search docs');
    await search.fill('legal');
    const sidebar = page.getByRole('navigation', { name: 'Documentation sections' });
    await expect(sidebar.getByRole('link', { name: 'Legal', exact: true })).toBeVisible();
  });

  test('docs pages are reachable from sidebar', async ({ page }) => {
    await page.goto('/docs');
    const sidebar = page.getByRole('navigation', { name: 'Documentation sections' });

    await sidebar.getByRole('link', { name: 'API', exact: true }).click();
    await expect(page).toHaveURL(/\/docs\/api$/);
    await expect(page.getByRole('heading', { name: /api integration/i })).toBeVisible();

    await sidebar.getByRole('link', { name: 'Enterprise', exact: true }).click();
    await expect(page).toHaveURL(/\/docs\/enterprise$/);
    await expect(page.getByRole('heading', { name: 'Enterprise', exact: true })).toBeVisible();
  });
});
