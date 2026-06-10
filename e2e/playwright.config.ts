import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Elite v1 storefront E2E suite.
 *
 * The target is configurable via BASE_URL (set it in CI or locally to point at
 * a preview/staging deploy). It defaults to the live Vercel production URL so
 * `npx playwright test` works out of the box.
 *
 * The storefront is Arabic-first and RTL by default, so specs are written to
 * tolerate either locale. We exercise both a desktop and a mobile viewport.
 */

const BASE_URL =
  process.env.BASE_URL?.replace(/\/$/, '') ??
  'https://remotion-project-6dvr.vercel.app';

export default defineConfig({
  testDir: './tests',
  // The suite hits a live deploy + live Supabase catalog, so be tolerant of
  // network latency rather than flaky-failing on it.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Cap workers in CI to stay friendly to the live backend.
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Kuwait audience: bias locale/timezone so Intl-formatted output (KWD,
    // dates) matches what real users see.
    locale: 'ar-KW',
    timezoneId: 'Asia/Kuwait',
    // Don't fail the whole run on a slow TLS handshake to the CDN.
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 900 },
      },
    },
    {
      name: 'mobile-safari',
      use: {
        // iPhone 13 — covers the mobile-first layout (hamburger nav, mobile
        // search bar, stacked grids).
        ...devices['iPhone 13'],
      },
    },
  ],
});
