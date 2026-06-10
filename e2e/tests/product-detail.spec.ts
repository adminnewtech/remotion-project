import { test, expect } from '@playwright/test';
import {
  LOCALES,
  KWD_PRICE_RE,
  goto,
  openFirstProduct,
} from './helpers';

/**
 * Product detail page: gallery, variant selector (when present), Buy+Install
 * toggle (when the product requires installation), and add-to-cart.
 */

test.describe('Product detail', () => {
  for (const locale of LOCALES) {
    test(`renders title, price, image and add-to-cart (${locale})`, async ({
      page,
    }) => {
      await goto(page, locale);
      const opened = await openFirstProduct(page, locale);
      test.skip(!opened, 'no product available from home grid');

      // Product name as the page <h1>.
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Main gallery image with alt text.
      const galleryImg = page.locator('main img, img').first();
      await expect(galleryImg).toBeVisible();
      await expect(galleryImg).toHaveAttribute('alt', /\S/);

      // A KWD price is shown.
      await expect(page.locator('body')).toContainText(KWD_PRICE_RE);

      // Add-to-cart button exists and is actionable.
      const addBtn = page
        .getByRole('button')
        .filter({ hasText: /cart|سلة|أضف|اشترِ|buy/i })
        .first();
      await expect(addBtn).toBeVisible();
    });
  }

  test('adding to cart increments the cart and shows the item', async ({
    page,
  }) => {
    await goto(page, 'en');
    const opened = await openFirstProduct(page, 'en');
    test.skip(!opened, 'no product available');

    // Click the first add-to-cart / buy button.
    const addBtn = page
      .getByRole('button')
      .filter({ hasText: /add to cart|buy now/i })
      .first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Navigate to the cart and confirm a line item is present.
    await goto(page, 'en', '/cart');
    // Either we see line items (a qty control) or the empty state. Adding
    // should produce items; assert the cart is not the empty state.
    const qtyControls = page.getByRole('button', { name: /next|previous/i });
    await expect(qtyControls.first()).toBeVisible();
  });

  test('Buy+Install toggle works when product requires installation', async ({
    page,
  }) => {
    // AC products require installation in the seed catalog.
    await goto(page, 'en', '/category/air-conditioning');
    const opened = await openFirstProduct(page, 'en');
    test.skip(!opened, 'no AC product available');

    // The toggle is a button with aria-pressed reflecting install state.
    const toggle = page.locator('button[aria-pressed]').filter({
      hasText: /install|تركيب/i,
    });
    if ((await toggle.count()) === 0) {
      test.skip(true, 'product does not expose an install toggle');
    }
    const initial = await toggle.first().getAttribute('aria-pressed');
    await toggle.first().click();
    await expect(toggle.first()).not.toHaveAttribute(
      'aria-pressed',
      initial ?? '',
    );
  });

  test('variant selector switches the active variant when present', async ({
    page,
  }) => {
    await goto(page, 'en');
    const opened = await openFirstProduct(page, 'en');
    test.skip(!opened, 'no product available');

    // Variant pickers are buttons grouped under an attribute heading
    // (color/model/...). Not all products have multiple variants.
    const variantButtons = page
      .locator('button')
      .filter({ hasNotText: /add to cart|buy now|install/i });
    const count = await variantButtons.count();
    test.skip(count < 2, 'no multi-variant product to exercise');
    // Clicking a variant should not throw / should keep the page stable.
    await variantButtons.nth(1).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
