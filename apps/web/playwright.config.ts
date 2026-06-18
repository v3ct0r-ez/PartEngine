import { defineConfig, devices } from '@playwright/test';

// E2E config (Sprint 9 — hardening).
//
// Run locally against a dev stack you already started (`pnpm dev`):
//   pnpm --filter @partengine/web test:e2e
// The webServer block below reuses that running server. In CI the full stack
// (Postgres + API + Next) is started by the workflow and E2E_NO_SERVER=1 is set,
// so Playwright just drives the already-running app at E2E_BASE_URL.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'pnpm --filter @partengine/web start',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
