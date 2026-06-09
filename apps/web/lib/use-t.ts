'use client';

/**
 * Client component translation hook. Binds the active locale (from context)
 * to the `t(key, locale, vars?)` function from @elite/i18n.
 */
import { useCallback } from 'react';
import { t as baseT } from '@/lib/i18n';
import { useLocale } from '@/components/providers';

export function useT() {
  const { locale } = useLocale();
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => baseT(key, locale, vars),
    [locale],
  );
  return { t, locale };
}
