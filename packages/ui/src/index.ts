/**
 * @elite/ui (root) — platform-agnostic exports.
 *
 * Tokens, status helpers, and formatters that are safe on both web and mobile.
 * Web React components live under `@elite/ui/web` and are NOT re-exported here
 * so the mobile bundle never pulls in DOM/React-web code.
 */
import type { Locale } from '@elite/types';

export * from './tokens';
export * from './status';

/**
 * Format an amount as Kuwaiti Dinar (KWD) with the conventional 3 decimals
 * (1 KWD = 1000 fils). Uses Intl with the locale's numbering, and the
 * resulting string is RTL-safe (Arabic places the currency naturally).
 */
export function formatKWD(amount: number, locale: Locale = 'ar'): string {
  const bcp47 = locale === 'ar' ? 'ar-KW' : 'en-KW';
  try {
    return new Intl.NumberFormat(bcp47, {
      style: 'currency',
      currency: 'KWD',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(amount);
  } catch {
    // Fallback if Intl currency data is unavailable in the runtime.
    const fixed = amount.toFixed(3);
    return locale === 'ar' ? `${fixed} د.ك` : `KWD ${fixed}`;
  }
}

/**
 * Format a date for display in the given locale.
 * Accepts a Date, epoch ms, or ISO string.
 */
export function formatDate(
  date: Date | string | number,
  locale: Locale = 'ar',
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const bcp47 = locale === 'ar' ? 'ar-KW' : 'en-KW';
  const opts: Intl.DateTimeFormatOptions = options ?? {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  try {
    return new Intl.DateTimeFormat(bcp47, opts).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
