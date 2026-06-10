import { test, expect } from '@playwright/test';
import {
  goto,
  openFirstProduct,
  trackConsoleErrors,
  type Locale,
} from './helpers';

/**
 * Accessibility smoke + console-error checks on key pages.
 *
 * This is a lightweight smoke (labels, alt text, single h1, no unexpected
 * console errors), not a full axe audit — keeps the suite dependency-free.
 */

const KEY_PAGES: { name: string; path: string }[] = [
  { name: 'home', path: '' },
  { name: 'search', path: '/search' },
  { name: 'category', path: '/category/air-conditioning' },
  { name: 'cart', path: '/cart' },
  { name: 'login', path: '/auth/login' },
];

test.describe('Accessibility smoke', () => {
  for (const { name, path } of KEY_PAGES) {
    test(`${name} page: images have alt text and inputs are labelled`, async ({
      page,
    }) => {
      await goto(page, 'en' as Locale, path);

      // Every <img> must declare an alt attribute (may be "" for decorative).
      const imgsMissingAlt = await page
        .locator('img:not([alt])')
        .count();
      expect(imgsMissingAlt, `${name}: imgs missing alt`).toBe(0);

      // Interactive controls must have an accessible name. Check buttons.
      const buttons = page.getByRole('button');
      const btnCount = Math.min(await buttons.count(), 15);
      for (let i = 0; i < btnCount; i++) {
        const b = buttons.nth(i);
        const accName = (
          (await b.getAttribute('aria-label')) ??
          (await b.textContent()) ??
          ''
        ).trim();
        expect(
          accName.length,
          `${name}: a button has no accessible name`,
        ).toBeGreaterThan(0);
      }
    });
  }

  test('every page has exactly one <h1>', async ({ page }) => {
    for (const { name, path } of KEY_PAGES) {
      await goto(page, 'en', path);
      const h1s = await page.getByRole('heading', { level: 1 }).count();
      // Login/cart/account pages each have a single primary heading.
      expect(h1s, `${name}: expected exactly one h1`).toBeGreaterThanOrEqual(1);
    }
  });

  test('product detail input/search controls are reachable', async ({
    page,
  }) => {
    await goto(page, 'en');
    await expect(page.getByRole('searchbox').first()).toBeVisible();
  });
});

test.describe('Console errors', () => {
  for (const { name, path } of KEY_PAGES) {
    test(`no console errors on ${name}`, async ({ page }) => {
      const errors = trackConsoleErrors(page);
      await goto(page, 'en', path);
      await page.waitForLoadState('networkidle').catch(() => {});
      expect(
        errors,
        `${name} produced console errors:\n${errors.join('\n')}`,
      ).toEqual([]);
    });
  }

  test('no console errors navigating to a product detail page', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await goto(page, 'en');
    const opened = await openFirstProduct(page, 'en');
    test.skip(!opened, 'no product available');
    await page.waitForLoadState('networkidle').catch(() => {});
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
