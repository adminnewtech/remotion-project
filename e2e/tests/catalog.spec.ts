import { test, expect } from '@playwright/test';
import {
  LOCALES,
  CATEGORY_SLUGS,
  KWD_PRICE_RE,
  goto,
} from './helpers';

/**
 * Category / catalog pages: product grids render, cards show a KWD price and
 * an image, and the page is titled with the category name.
 */

test.describe('Category pages', () => {
  for (const locale of LOCALES) {
    test(`category grid renders cards with price + image (${locale})`, async ({
      page,
    }) => {
      // Try known slugs until one loads products (catalog is live, so be
      // resilient to a renamed/empty category).
      let loaded = false;
      for (const slug of CATEGORY_SLUGS) {
        await goto(page, locale, `/category/${slug}`);
        const cards = page.locator(`a[href*="/${locale}/product/"]`);
        if ((await cards.count()) > 0) {
          loaded = true;

          // Heading for the category.
          await expect(
            page.getByRole('heading', { level: 1 }),
          ).toBeVisible();

          const firstCard = cards.first();
          await expect(firstCard).toBeVisible();

          // Card shows a product image with alt text.
          const img = firstCard.locator('img').first();
          await expect(img).toBeVisible();
          await expect(img).toHaveAttribute('alt', /\S/);

          // Card shows a KWD price somewhere in its text.
          await expect(firstCard).toContainText(KWD_PRICE_RE);
          break;
        }
      }
      expect(loaded, 'at least one known category should list products').toBe(
        true,
      );
    });
  }

  test('unknown category slug returns a not-found page', async ({ page }) => {
    const res = await page.goto('/en/category/__does-not-exist__', {
      waitUntil: 'domcontentloaded',
    });
    // Next.js notFound() renders the 404 boundary (status may be 404 or 200
    // for a soft-rendered boundary); assert on content rather than status.
    expect(res?.status() ?? 200).toBeLessThan(500);
    await expect(
      page.locator(`a[href*="/en/product/"]`),
    ).toHaveCount(0);
  });

  test('product cards link to a valid product detail page', async ({
    page,
  }) => {
    await goto(page, 'en');
    const card = page.locator(`a[href*="/en/product/"]`).first();
    await expect(card).toBeVisible();
    await card.click();
    await page.waitForURL('**/en/product/**');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
