/**
 * Format helpers, re-exported from @elite/ui so the whole app imports them
 * from a single place. Thin app-local wrappers can live here too.
 */
export { formatKWD, formatDate } from '@elite/ui';
import { formatKWD } from '@elite/ui';
import type { Locale } from '@elite/types';

/** Localized relative-ish day label, e.g. "Today" / "اليوم". */
export function dayLabel(iso: string, locale: Locale): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return locale === 'ar' ? 'اليوم' : 'Today';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-KW' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

/**
 * App-local KWD formatter. Independent of the @elite/ui `formatKWD` signature
 * so app components never break on a contract mismatch. KWD uses 3 decimals.
 */
export function fmtKWD(amount: number, locale: Locale = 'en'): string {
  const n = new Intl.NumberFormat(locale === 'ar' ? 'ar-KW' : 'en-KW', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
  return locale === 'ar' ? `${n} د.ك` : `${n} KWD`;
}

/** App-local date formatter. */
export function fmtDate(iso: string, locale: Locale = 'en'): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-KW' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

/** Price with optional strikethrough sale display. */
export function priceParts(price: number, salePrice: number | null) {
  const hasSale = salePrice != null && salePrice < price;
  return {
    hasSale,
    current: formatKWD(hasSale ? (salePrice as number) : price),
    original: hasSale ? formatKWD(price) : null,
  };
}
