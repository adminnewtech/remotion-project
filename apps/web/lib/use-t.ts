'use client';

/**
 * Client component translation hook. Binds the active locale (from context)
 * to the `t(key, locale, vars?)` function from @elite/i18n.
 */
import { useCallback } from 'react';
import type { TranslationKey } from '@elite/i18n';
import { t as baseT } from '@/lib/i18n';
import { useLocale } from '@/components/providers';

/**
 * Translation key accepted by the hook. Known keys get autocomplete via
 * `TranslationKey`; dynamically-built keys (e.g. `product.${attr}`) are also
 * allowed because `t()` safely falls back to the raw key when it isn't found.
 */
type LooseKey = TranslationKey | (string & {});

export function useT() {
  const { locale } = useLocale();
  const t = useCallback(
    (key: LooseKey, vars?: Record<string, string | number>) =>
      baseT(key as TranslationKey, locale, vars),
    [locale],
  );
  return { t, locale };
}
