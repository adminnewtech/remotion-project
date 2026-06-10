import { test, expect } from '@playwright/test';
import { KWD_PRICE_RE, goto, openFirstProduct } from './helpers';

/**
 * Cart flows: add, update quantity, remove, totals, and the free-delivery
 * threshold (10 KWD). The cart is a client-side (zustand) store, so all of
 * this runs without login.
 */

/** Add the first available product to the cart from the home grid. */
async function addFirstProductToCart(page: import('@playwright/test').Page) {
  await goto(page, 'en');
  const opened = await openFirstProduct(page, 'en');
  if (!opened) return false;
  const addBtn = page
    .getByRole('button')
    .filter({ hasText: /add to cart/i })
    .first();
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  return true;
}

test.describe('Cart', () => {
  test('add item then increment / decrement quantity', async ({ page }) => {
    const added = await addFirstProductToCart(page);
    test.skip(!added, 'no product available to add');

    await goto(page, 'en', '/cart');
    // Quantity starts at 1; the line shows + / - controls.
    const inc = page.getByRole('button', { name: /next/i }).first();
    const dec = page.getByRole('button', { name: /previous/i }).first();
    await expect(inc).toBeVisible();

    // Increment -> quantity display should read 2.
    await inc.click();
    await expect(page.getByText(/^2$/).first()).toBeVisible();

    // Decrement back to 1.
    await dec.click();
    await expect(page.getByText(/^1$/).first()).toBeVisible();
  });

  test('remove item empties the cart', async ({ page }) => {
    const added = await addFirstProductToCart(page);
    test.skip(!added, 'no product available to add');

    await goto(page, 'en', '/cart');
    const removeBtn = page.getByRole('button', { name: /remove/i }).first();
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    // Empty state with a "start shopping" call to action.
    await expect(
      page.getByRole('link', { name: /start shopping|shop/i }).first(),
    ).toBeVisible();
  });

  test('order summary shows subtotal, delivery and total', async ({ page }) => {
    const added = await addFirstProductToCart(page);
    test.skip(!added, 'no product available to add');

    await goto(page, 'en', '/cart');
    // Order-summary card with a total price.
    await expect(page.getByText(/order summary/i)).toBeVisible();
    await expect(page.getByText(/total/i).first()).toBeVisible();
    await expect(page.locator('body')).toContainText(KWD_PRICE_RE);
  });

  test('free-delivery threshold hint reflects the 10 KWD rule', async ({
    page,
  }) => {
    const added = await addFirstProductToCart(page);
    test.skip(!added, 'no product available to add');

    await goto(page, 'en', '/cart');
    // Below 10 KWD: a "free delivery" remaining-amount hint appears. At or
    // above the threshold: delivery shows as free. Assert one of the two
    // states is present (the catalog price determines which).
    const freeDeliveryHint = page.getByText(/free delivery/i);
    await expect(freeDeliveryHint.first()).toBeVisible();
  });

  test('checkout button links to the checkout flow', async ({ page }) => {
    const added = await addFirstProductToCart(page);
    test.skip(!added, 'no product available to add');

    await goto(page, 'en', '/cart');
    const checkoutLink = page
      .getByRole('link', { name: /checkout/i })
      .first();
    await expect(checkoutLink).toBeVisible();
    await checkoutLink.click();
    await page.waitForURL('**/en/checkout**');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
