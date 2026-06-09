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

/** Pick the localized field from a `{ name_ar, name_en }`-style record. */
export function localized<
  T extends Record<string, unknown>,
  K extends string,
>(row: T, base: K, locale: Locale): string {
  const key = `${base}_${locale}` as keyof T;
  const fallback = `${base}_en` as keyof T;
  return (row[key] ?? row[fallback] ?? '') as string;
}

export { baseT as t, isRTL, dir, messages };
export type { Locale };
