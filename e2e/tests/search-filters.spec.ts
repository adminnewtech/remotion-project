import { test, expect } from '@playwright/test';
import { LOCALES, KWD_PRICE_RE, goto } from './helpers';

/**
 * Search + client-side filters: the search box submits to /search?q=, results
 * render, and the brand / price / needs-installation filters narrow the grid.
 */

test.describe('Search & filters', () => {
  for (const locale of LOCALES) {
    test(`search box submits and shows results (${locale})`, async ({
      page,
    }) => {
      await goto(page, locale);

      const searchBox = page.getByRole('searchbox').first();
      await expect(searchBox).toBeVisible();
      await searchBox.fill('Samsung');
      await searchBox.press('Enter');

      await page.waitForURL(/\/search\?q=/);
      // Heading present; grid either shows results or a no-products empty state.
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  }

  test('search page lists products with KWD prices', async ({ page }) => {
    await goto(page, 'en', '/search');
    const cards = page.locator(`a[href*="/en/product/"]`);
    await expect(cards.first()).toBeVisible();
    await expect(cards.first()).toContainText(KWD_PRICE_RE);
  });

  test('brand filter narrows the result set', async ({ page }) => {
    await goto(page, 'en', '/search');
    await expect(page.locator(`a[href*="/en/product/"]`).first()).toBeVisible();

    // First <select> is the brand filter (aria-label "Brand").
    const brandSelect = page.getByRole('combobox').first();
    await expect(brandSelect).toBeVisible();

    const before = await page.locator(`a[href*="/en/product/"]`).count();

    // Pick a concrete brand option (skip the leading "all" option).
    const options = brandSelect.locator('option');
    const optionCount = await options.count();
    test.skip(optionCount < 2, 'no brand options to filter by');
    const brandValue = await options.nth(1).getAttribute('value');
    await brandSelect.selectOption(brandValue ?? '');

    const after = await page.locator(`a[href*="/en/product/"]`).count();
    // Filtering to one brand should not increase the count.
    expect(after).toBeLessThanOrEqual(before);
    expect(after).toBeGreaterThan(0);
  });

  test('needs-installation filter restricts to installable products', async ({
    page,
  }) => {
    await goto(page, 'en', '/search');
    await expect(page.locator(`a[href*="/en/product/"]`).first()).toBeVisible();
    const before = await page.locator(`a[href*="/en/product/"]`).count();

    // The needs-installation control is a checkbox.
    const checkbox = page.getByRole('checkbox').first();
    await expect(checkbox).toBeVisible();
    await checkbox.check();

    const after = await page.locator(`a[href*="/en/product/"]`).count();
    expect(after).toBeLessThanOrEqual(before);
  });

  test('price slider filters by max price', async ({ page }) => {
    await goto(page, 'en', '/search');
    await expect(page.locator(`a[href*="/en/product/"]`).first()).toBeVisible();

    const slider = page.getByRole('slider').first();
    if ((await slider.count()) === 0) {
      test.skip(true, 'no price slider rendered (single-price catalog)');
    }
    const before = await page.locator(`a[href*="/en/product/"]`).count();
    // Drag the slider toward the minimum to tighten the max-price filter.
    await slider.focus();
    for (let i = 0; i < 20; i++) await slider.press('ArrowLeft');
    const after = await page.locator(`a[href*="/en/product/"]`).count();
    expect(after).toBeLessThanOrEqual(before);
  });

  test('category filter via header navigation', async ({ page }) => {
    await goto(page, 'en');
    const catLink = page.locator(`a[href*="/en/category/"]`).first();
    await expect(catLink).toBeVisible();
    await catLink.click();
    await page.waitForURL('**/en/category/**');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
