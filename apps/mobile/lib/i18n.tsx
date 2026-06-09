/**
 * Locale provider + `useLocale` hook for the mobile app.
 *
 * Wraps @elite/i18n (`t`, `isRTL`, `dir`) with React state + AsyncStorage
 * persistence and wires React Native's `I18nManager` so the whole UI flips to
 * RTL for Arabic. Default locale is Arabic (Arabic-first product).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t as translate, isRTL as localeIsRTL, dir as localeDir } from '@elite/i18n';
import type { Locale } from '@elite/types';

const STORAGE_KEY = 'elite.locale';
const DEFAULT_LOCALE: Locale = 'ar';

interface LocaleContextValue {
  locale: Locale;
  isRTL: boolean;
  dir: 'rtl' | 'ltr';
  setLocale: (next: Locale) => Promise<void>;
  toggleLocale: () => Promise<void>;
  /** Translate a key in the current locale. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Hydrate persisted locale and apply RTL direction on mount.
  useEffect(() => {
    (async () => {
      const stored = (await AsyncStorage.getItem(STORAGE_KEY)) as Locale | null;
      const initial = stored ?? DEFAULT_LOCALE;
      setLocaleState(initial);
      applyDirection(initial);
    })();
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
    applyDirection(next);
  }, []);

  const toggleLocale = useCallback(
    () => setLocale(locale === 'ar' ? 'en' : 'ar'),
    [locale, setLocale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      isRTL: localeIsRTL(locale),
      dir: localeDir(locale),
      setLocale,
      toggleLocale,
      t: (key, vars) => translate(key, locale, vars),
    }),
    [locale, setLocale, toggleLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within <LocaleProvider>');
  return ctx;
}

/**
 * Force React Native layout direction to match the locale. Note: a full RTL
 * flip on a running app technically needs a reload (Updates.reloadAsync) to
 * take effect everywhere; we set it eagerly so the next mount is correct and
 * the initial launch is already right for the default Arabic locale.
 */
function applyDirection(locale: Locale) {
  const rtl = localeIsRTL(locale);
  I18nManager.allowRTL(rtl);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
  }
}
