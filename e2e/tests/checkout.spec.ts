import { test, expect } from '@playwright/test';
import { goto, openFirstProduct } from './helpers';

/**
 * Checkout stepper: address -> delivery slot -> (installation) -> payment.
 *
 * We drive the flow up to the payment step only (we never place an order /
 * trigger a real KNET payment). The flow requires a non-empty cart, which we
 * seed by adding a product first.
 */

async function seedCartAndOpenCheckout(page: import('@playwright/test').Page) {
  await goto(page, 'en');
  const opened = await openFirstProduct(page, 'en');
  if (!opened) return false;
  const addBtn = page
    .getByRole('button')
    .filter({ hasText: /add to cart/i })
    .first();
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  await goto(page, 'en', '/checkout');
  return true;
}

test.describe('Checkout', () => {
  test('renders the stepper starting at the address step', async ({ page }) => {
    const ok = await seedCartAndOpenCheckout(page);
    test.skip(!ok, 'could not seed cart');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // The stepper is an ordered list of steps; the address form is first.
    await expect(page.getByRole('list').first()).toBeVisible();
    // Address inputs (label / governorate / area ...) are present.
    await expect(page.getByRole('combobox').first()).toBeVisible();
    await expect(page.getByRole('textbox').first()).toBeVisible();
  });

  test('advances address -> delivery -> payment', async ({ page }) => {
    const ok = await seedCartAndOpenCheckout(page);
    test.skip(!ok, 'could not seed cart');

    const next = () =>
      page.getByRole('button', { name: /continue/i }).first();

    // Step 1 (address) -> Step 2 (delivery slot).
    await expect(next()).toBeVisible();
    await next().click();

    // Delivery slot step: time-slot buttons (e.g. "09:00–12:00") are shown.
    await expect(
      page.getByRole('button', { name: /\d{2}:\d{2}/ }).first(),
    ).toBeVisible();
    // Pick a slot then continue.
    await page.getByRole('button', { name: /\d{2}:\d{2}/ }).first().click();
    await next().click();

    // We should now be on the payment step (may be preceded by an
    // installation step if the item requires it — click through it too).
    if (await next().isVisible().catch(() => false)) {
      // Possibly the installation slot step; pick a slot and continue.
      const slot = page.getByRole('button', { name: /\d{2}:\d{2}/ }).first();
      if (await slot.isVisible().catch(() => false)) {
        await slot.click();
        await next().click();
      }
    }

    // Payment step: payment-method radios (KNET, COD, ...) are present, and a
    // "place order" button exists. We stop here — do NOT place the order.
    await expect(page.getByRole('radio').first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: /place order/i }),
    ).toBeVisible();
  });

  test('payment step exposes KNET and Cash-on-Delivery options', async ({
    page,
  }) => {
    const ok = await seedCartAndOpenCheckout(page);
    test.skip(!ok, 'could not seed cart');

    const next = () =>
      page.getByRole('button', { name: /continue/i }).first();

    // Click through every non-final step to reach payment.
    for (let i = 0; i < 4; i++) {
      const place = page.getByRole('button', { name: /place order/i });
      if (await place.isVisible().catch(() => false)) break;
      // Pick a slot if this is a slot step.
      const slot = page.getByRole('button', { name: /\d{2}:\d{2}/ }).first();
      if (await slot.isVisible().catch(() => false)) await slot.click();
      if (await next().isVisible().catch(() => false)) await next().click();
      else break;
    }

    const radios = page.getByRole('radio');
    await expect(radios.first()).toBeVisible();
    // Payment labels mention KNET and cash/COD.
    await expect(page.locator('body')).toContainText(/knet/i);
    await expect(page.locator('body')).toContainText(/cash|cod|الدفع عند/i);
  });
});
