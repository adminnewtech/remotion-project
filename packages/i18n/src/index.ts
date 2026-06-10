/**
 * @elite/i18n — shared i18n for Elite v1 (Newtech super-app).
 *
 * Arabic-first (RTL) + English. Dictionaries are nested objects with identical
 * keys; `t()` resolves a dot-path key for a locale and interpolates {vars}.
 */
import type { Locale } from '@elite/types';

import { ar } from './ar';
import { en, type Dictionary } from './en';

export { ar } from './ar';
export { en, type Dictionary } from './en';

/** All dictionaries keyed by locale. */
export const messages: Record<Locale, Dictionary> = { ar, en };

export const DEFAULT_LOCALE: Locale = 'ar';
export const LOCALES: readonly Locale[] = ['ar', 'en'] as const;

/** Variables passed to `t()` for {placeholder} interpolation. */
export type TranslateVars = Record<string, string | number>;

/**
 * Recursively builds the union of dot-path string keys for a nested
 * dictionary, e.g. "common.ok" | "checkout.steps.address" | ...
 */
type DotPaths<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends Record<string, unknown>
      ? `${K}.${DotPaths<T[K]>}`
      : never;
}[keyof T & string];

/** All valid translation keys (leaf paths only). */
export type TranslationKey = DotPaths<Dictionary>;

/** Returns true when the locale is right-to-left. */
export function isRTL(locale: Locale): boolean {
  return locale === 'ar';
}

/** Returns the text direction for a locale. */
export function dir(locale: Locale): 'rtl' | 'ltr' {
  return isRTL(locale) ? 'rtl' : 'ltr';
}

/** Walks a dot-path against a dictionary; returns the leaf string or undefined. */
function resolve(dict: Dictionary, key: string): string | undefined {
  const parts = key.split('.');
  let node: unknown = dict;
  for (const part of parts) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Replaces {name} placeholders in a template with provided values. */
function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Translate a dot-path `key` for `locale`, interpolating `{vars}`.
 * Falls back to the other locale, then to the raw key, so the UI never breaks.
 */
export function t(key: TranslationKey, locale: Locale, vars?: TranslateVars): string {
  const primary = resolve(messages[locale], key);
  if (primary !== undefined) return interpolate(primary, vars);

  const fallbackLocale: Locale = locale === 'ar' ? 'en' : 'ar';
  const fallback = resolve(messages[fallbackLocale], key);
  if (fallback !== undefined) return interpolate(fallback, vars);

  return key;
}
