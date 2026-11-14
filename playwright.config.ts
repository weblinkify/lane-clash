import { defineConfig, devices } from '@playwright/test';

// The smoke test runs against the production build. By default that is the `web` compose
// service on http://localhost:8080; inside the `e2e` container it shares web's network.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
});
