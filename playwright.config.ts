import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.PCPARTCHECK_E2E_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'output/playwright/test-results',
  reporter: [['list'], ['html', { outputFolder: 'output/playwright/report', open: 'never' }]],
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
  },
  webServer: externalBaseUrl ? undefined : [
    {
      command: 'corepack pnpm --filter @pcpartcheck/reference-api start',
      url: 'http://127.0.0.1:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'corepack pnpm --filter @pcpartcheck/demo-web start',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { PCPARTCHECK_API_URL: 'http://127.0.0.1:3001/v1/demo' },
    },
  ],
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
