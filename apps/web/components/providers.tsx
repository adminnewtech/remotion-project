'use client';

/**
 * Client-side providers tree:
 *  - TanStack Query (one client per browser session)
 *  - Supabase client context (browser singleton, may be null when env absent)
 *  - Locale context (active locale + direction, from the [locale] segment)
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { EliteClient } from '@elite/core';
import type { Locale } from '@elite/types';
import { makeQueryClient } from '@/lib/query-client';
import { getBrowserClient } from '@/lib/supabase/client';
import { dir, isRTL } from '@/lib/i18n';

// ── Supabase context ────────────────────────────────────────
const SupabaseContext = createContext<EliteClient | null>(null);
export function useSupabase(): EliteClient | null {
  return useContext(SupabaseContext);
}

// ── Locale context ──────────────────────────────────────────
interface LocaleCtx {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  isRTL: boolean;
}
const LocaleContext = createContext<LocaleCtx>({ locale: 'ar', dir: 'rtl', isRTL: true });
export function useLocale(): LocaleCtx {
  return useContext(LocaleContext);
}

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  // Stable per-session query client.
  const [queryClient] = useState(() => makeQueryClient());
  const supabase = useMemo(() => getBrowserClient(), []);
  const localeValue = useMemo<LocaleCtx>(
    () => ({ locale, dir: dir(locale) as 'rtl' | 'ltr', isRTL: isRTL(locale) }),
    [locale],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseContext.Provider value={supabase}>
        <LocaleContext.Provider value={localeValue}>{children}</LocaleContext.Provider>
      </SupabaseContext.Provider>
    </QueryClientProvider>
  );
}
