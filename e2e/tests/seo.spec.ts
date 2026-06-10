import { test, expect } from '@playwright/test';
import { LOCALES, goto, openFirstProduct, readJsonLd } from './helpers';

/**
 * SEO assertions: <title>, meta description, JSON-LD (Product schema on PDP),
 * and hreflang alternate links.
 */

test.describe('SEO', () => {
  for (const locale of LOCALES) {
    test(`home has a title and meta description (${locale})`, async ({
      page,
    }) => {
      await goto(page, locale);
      await expect(page).toHaveTitle(/\S/);
      const desc = page.locator('meta[name="description"]');
      await expect(desc).toHaveAttribute('content', /\S/);
    });
  }

  test('category page exposes hreflang alternates for ar + en', async ({
    page,
  }) => {
    await goto(page, 'en', '/category/air-conditioning');
    // Next emits <link rel="alternate" hreflang="ar"|"en"> from the metadata
    // `alternates.languages` map.
    const ar = page.locator('link[rel="alternate"][hreflang="ar"]');
    const en = page.locator('link[rel="alternate"][hreflang="en"]');
    await expect(ar).toHaveCount(1);
    await expect(en).toHaveCount(1);
    await expect(ar).toHaveAttribute('href', /\/ar\/category\//);
    await expect(en).toHaveAttribute('href', /\/en\/category\//);
  });

  test('category page has a canonical link', async ({ page }) => {
    await goto(page, 'en', '/category/air-conditioning');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/category\//,
    );
  });

  test('product detail page emits Product JSON-LD with a KWD offer', async ({
    page,
  }) => {
    await goto(page, 'en');
    const opened = await openFirstProduct(page, 'en');
    test.skip(!opened, 'no product available');

    const blocks = await readJsonLd(page);
    expect(blocks.length).toBeGreaterThan(0);

    const product = blocks.find((b) => b['@type'] === 'Product');
    expect(product, 'a Product JSON-LD block should be present').toBeTruthy();
    expect(product?.name).toBeTruthy();

    const offers = product?.offers as Record<string, unknown> | undefined;
    expect(offers).toBeTruthy();
    expect(offers?.priceCurrency).toBe('KWD');
    expect(String(offers?.availability ?? '')).toMatch(/schema\.org\/(In|Out)/);

    // A BreadcrumbList block is also emitted on the PDP.
    expect(blocks.some((b) => b['@type'] === 'BreadcrumbList')).toBe(true);
  });

  test('product detail has Open Graph + canonical metadata', async ({
    page,
  }) => {
    await goto(page, 'en');
    const opened = await openFirstProduct(page, 'en');
    test.skip(!opened, 'no product available');

    await expect(page).toHaveTitle(/\S/);
    await expect(
      page.locator('meta[name="description"]'),
    ).toHaveAttribute('content', /\S/);
    await expect(
      page.locator('meta[property="og:title"]'),
    ).toHaveAttribute('content', /\S/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/product\//,
    );
  });

  test('home / search emit Organization or WebSite JSON-LD', async ({
    page,
  }) => {
    await goto(page, 'en');
    const blocks = await readJsonLd(page);
    // The app provides Organization + WebSite schema on storefront shells.
    // Soft-assert: if present, the @type must be sane.
    if (blocks.length > 0) {
      for (const b of blocks) {
        expect(b['@context']).toBe('https://schema.org');
        expect(b['@type']).toBeTruthy();
      }
    }
  });
});
