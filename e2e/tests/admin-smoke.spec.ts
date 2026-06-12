import { test, expect } from '@playwright/test';

/**
 * Unauthenticated smoke tests for the /ar/admin surface.
 *
 * These pages render with sample data when no session exists (role guards
 * either render the module content or a guard message — both are acceptable).
 * We only assert the basics for each route:
 *   1. The navigation responds 200.
 *   2. No Next.js error overlay / crash screen is shown.
 *   3. The page actually rendered some content (non-empty body text and,
 *      when present, a non-empty <main>).
 *
 * Selectors stay generic and locale-agnostic so the suite is RTL/Arabic safe.
 */

const ADMIN_ROUTES = [
  '/ar/admin',
  '/ar/admin/orders',
  '/ar/admin/catalog',
  '/ar/admin/catalog/inventory',
  '/ar/admin/purchasing',
  '/ar/admin/cashier',
  '/ar/admin/customers',
  '/ar/admin/workshop',
  '/ar/admin/dispatch',
  '/ar/admin/appointments',
  '/ar/admin/support',
  '/ar/admin/marketing',
  '/ar/admin/finance',
  '/ar/admin/staff',
  '/ar/admin/analytics',
  '/ar/admin/settings',
] as const;

test.describe('Admin smoke (unauthenticated)', () => {
  for (const route of ADMIN_ROUTES) {
    test(`renders ${route} without crashing`, async ({ page }) => {
      const res = await page.goto(route, { waitUntil: 'domcontentloaded' });

      // 1. The route itself must answer 200 (redirect chains are followed by
      //    Playwright, so this is the final document response).
      expect(res, `no document response for ${route}`).not.toBeNull();
      expect(res!.status(), `expected 200 for ${route}`).toBe(200);

      // 2. No Next.js error surface:
      //    - dev overlay portal (<nextjs-portal>)
      //    - prod client-crash screen ("Application error: a client-side
      //      exception has occurred")
      //    - unhandled runtime error dialog
      await expect(page.locator('nextjs-portal')).toHaveCount(0);
      await expect(
        page.locator('body', {
          hasText: 'Application error: a client-side exception has occurred',
        }),
      ).toHaveCount(0);
      await expect(
        page.locator('#__next_error__, [data-nextjs-dialog]'),
      ).toHaveCount(0);

      // 3. The page rendered real content. Role guards may render either the
      //    module UI (sample data) or a guard message — both produce text.
      const bodyText = (await page.locator('body').innerText()).trim();
      expect(
        bodyText.length,
        `expected non-empty body text on ${route}`,
      ).toBeGreaterThan(0);

      // If the page uses a <main> landmark, it should not be empty either.
      const main = page.locator('main').first();
      if ((await main.count()) > 0) {
        const mainText = (await main.innerText()).trim();
        expect(
          mainText.length,
          `expected non-empty <main> on ${route}`,
        ).toBeGreaterThan(0);
      }
    });
  }
});
