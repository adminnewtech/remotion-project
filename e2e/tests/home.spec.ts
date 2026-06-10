import { test, expect } from '@playwright/test';
import { LOCALES, goto, expectHtmlLangDir, header } from './helpers';

/**
 * Home page + global chrome: loads in both locales, header/nav present,
 * language switch works, RTL direction is correct.
 */

test.describe('Home page', () => {
  for (const locale of LOCALES) {
    test(`loads and renders core chrome (${locale})`, async ({ page }) => {
      await goto(page, locale);

      // Correct document language + direction.
      await expectHtmlLangDir(page, locale);

      // Header / banner with the Elite brand link to home.
      await expect(header(page)).toBeVisible();
      const brand = header(page).getByRole('link').first();
      await expect(brand).toBeVisible();

      // A primary <h1> hero headline is present.
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Category navigation: links into /category/<slug> exist.
      const categoryLinks = page.locator(`a[href*="/${locale}/category/"]`);
      await expect(categoryLinks.first()).toBeVisible();

      // Featured grid: at least one product link is rendered.
      await expect(
        page.locator(`a[href*="/${locale}/product/"]`).first(),
      ).toBeVisible();
    });
  }

  test('language switch toggles ar <-> en and flips direction', async ({
    page,
  }) => {
    await goto(page, 'ar');
    await expectHtmlLangDir(page, 'ar');

    // The switch exposes an "EN" toggle button.
    const enToggle = page.getByRole('button', { name: 'EN' });
    await expect(enToggle).toBeVisible();
    await enToggle.click();

    await page.waitForURL('**/en**');
    await expectHtmlLangDir(page, 'en');

    // Switch back to Arabic.
    const arToggle = page.getByRole('button', { name: 'ع' });
    await arToggle.click();
    await page.waitForURL('**/ar**');
    await expectHtmlLangDir(page, 'ar');
  });

  test('bare root redirects/serves a usable storefront', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Either a redirect to a locale or a direct 2xx render is acceptable.
    expect(res?.status() ?? 200).toBeLessThan(400);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
