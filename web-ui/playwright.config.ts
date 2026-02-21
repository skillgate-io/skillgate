import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? 4010);
const host = process.env.PLAYWRIGHT_HOST ?? '127.0.0.1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://${host}:${port}`;
const analyticsEndpoint =
  process.env.PLAYWRIGHT_ANALYTICS_ENDPOINT ?? `http://${host}:${port}/__analytics`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command:
      `NEXT_PUBLIC_ANALYTICS_ENDPOINT=${analyticsEndpoint} ` +
      'NEXT_PUBLIC_ANALYTICS_FLUSH_SIZE=1 ' +
      `PORT=${port} npm run dev -- --port ${port} --hostname ${host}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
