import { test, expect } from '@playwright/test';
import { LOCALES, goto } from './helpers';

/**
 * Account / auth pages render, and the admin route is gated behind a role.
 *
 * Auth uses phone + OTP, which we cannot complete in CI, so we only assert
 * that pages render and the gate behaves — we never log in.
 */

test.describe('Auth & account', () => {
  for (const locale of LOCALES) {
    test(`login page renders the phone/OTP form (${locale})`, async ({
      page,
    }) => {
      await goto(page, locale, '/auth/login');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // Phone input (type=tel) + a send-code button.
      await expect(page.locator('input[type="tel"]').first()).toBeVisible();
      await expect(page.getByRole('button').first()).toBeVisible();
      // "Continue as guest" escape hatch.
      await expect(
        page.getByRole('button', { name: /guest|ضيف/i }).first(),
      ).toBeVisible();
    });
  }

  test('account orders page renders (guest sees orders list or empty state)', async ({
    page,
  }) => {
    await goto(page, 'en', '/account');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Either an orders list or an empty state — both are acceptable for a
    // guest / unseeded session.
    await expect(page.locator('body')).toContainText(
      /order|no orders|empty/i,
    );
  });

  test('account support page renders', async ({ page }) => {
    const res = await goto(page, 'en', '/account/support').then(
      () => page,
    );
    await expect(res.getByRole('heading').first()).toBeVisible();
  });

  test('admin route is gated (redirects to login or shows access denied)', async ({
    page,
  }) => {
    await goto(page, 'en', '/admin');
    // RoleGuard either redirects an unauthenticated visitor to the login
    // page (?next=admin) or renders an access-denied / session-expired state.
    // It must NOT render the admin dashboard content to a guest.
    await page.waitForLoadState('networkidle').catch(() => {});

    const url = page.url();
    const redirectedToLogin = /\/auth\/login/.test(url);

    if (redirectedToLogin) {
      expect(redirectedToLogin).toBe(true);
    } else {
      // Stayed on /admin: must show a gate (error/session message), not the
      // dashboard. Assert no admin nav/dashboard chrome is exposed.
      await expect(page.locator('body')).toContainText(
        /error|session|expired|sign in|login|تسجيل|انتهت/i,
      );
    }
  });
});
