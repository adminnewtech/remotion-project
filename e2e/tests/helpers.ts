import { expect, type Page, type Locator } from '@playwright/test';

/**
 * Shared helpers for the Elite storefront E2E suite.
 *
 * The site is Arabic-first (RTL) with /ar and /en locales reading a live
 * Supabase catalog. Helpers here keep specs resilient: they tolerate either
 * locale, prefer role/text selectors, and treat login-gated state softly.
 */

export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** A few known category slugs from the seeded catalog (stable across locales). */
export const CATEGORY_SLUGS = [
  'tvs-displays',
  'air-conditioning',
  'home-appliances',
  'audio-sound',
  'smart-home',
  'computers',
] as const;

/**
 * Matches a KWD price as rendered by the app, in either locale:
 *   "289.000 KWD"  (en)   |   "٢٨٩٫٠٠٠ د.ك" / "289.000 د.ك" (ar)
 * Accepts ASCII or Arabic-Indic digits and the KWD / د.ك currency token.
 */
export const KWD_PRICE_RE =
  /[\d٠-٩][\d٠-٩.,٫٬\s]*\s*(KWD|د\.?\s?ك)/u;

/** Navigate to a locale-prefixed path and wait for the DOM to settle. */
export async function goto(page: Page, locale: Locale, path = '') {
  const clean = path.startsWith('/') ? path : path ? `/${path}` : '';
  await page.goto(`/${locale}${clean}`, { waitUntil: 'domcontentloaded' });
}

/** Assert <html lang> and <html dir> match the expected locale. */
export async function expectHtmlLangDir(page: Page, locale: Locale) {
  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', locale);
  await expect(html).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
}

/** The site header is a <header> with brand + nav. */
export function header(page: Page): Locator {
  return page.getByRole('banner').first();
}

/**
 * Open the first product detail page reachable from a grid on the current
 * page. Returns true if it navigated, false if no product links were found
 * (e.g. the catalog was empty / failed to load — caller can soft-skip).
 */
export async function openFirstProduct(
  page: Page,
  locale: Locale,
): Promise<boolean> {
  const card = page.locator(`a[href*="/${locale}/product/"]`).first();
  if ((await card.count()) === 0) return false;
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await page.waitForURL(`**/${locale}/product/**`);
  return true;
}

/**
 * Collect console errors during a block of work. Filters out noise that is
 * out of our control (third-party image CDN, favicon, analytics blockers).
 */
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (
      /favicon|unsplash|googletagmanager|gtag|net::ERR_|Failed to load resource/i.test(
        text,
      )
    ) {
      return;
    }
    errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

/** Read and parse every JSON-LD <script> block on the page. */
export async function readJsonLd(page: Page): Promise<Record<string, unknown>[]> {
  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const out: Record<string, unknown>[] = [];
  for (const raw of blocks) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      // ignore malformed block; the spec will assert on what parsed
    }
  }
  return out;
}
