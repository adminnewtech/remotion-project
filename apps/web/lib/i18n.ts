/**
 * Locale utilities for the App Router. Wraps @elite/i18n and adds web-specific
 * helpers (validating the [locale] segment, picking the localized field).
 */
import { t as baseT, isRTL, dir, messages } from '@elite/i18n';
import type { Locale } from '@elite/types';

export const LOCALES: Locale[] = ['ar', 'en'];
export const DEFAULT_LOCALE: Locale = 'ar';

export function isLocale(value: string | undefined): value is Locale {
  return value === 'ar' || value === 'en';
}

/** Normalize an incoming route segment to a supported locale. */
export function coerceLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Pick the localized field from a `{ name_ar, name_en }`-style record.
 *
 * Constrained to `object` (rather than `Record<string, unknown>`) so plain
 * domain interfaces like `Category`/`Product` — which have no index signature —
 * are accepted directly without casting at every call site.
 */
export function localized<T extends object, K extends string>(
  row: T,
  base: K,
  locale: Locale,
): string {
  const record = row as Record<string, unknown>;
  const value = record[`${base}_${locale}`] ?? record[`${base}_en`] ?? '';
  return value as string;
}

export { baseT as t, isRTL, dir, messages };
export type { Locale };
