'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

/**
 * OSALPHA light/dark toggle. Flips `data-theme` on <html> and persists the
 * choice to localStorage (`osalpha-theme`). The locale layout reads the same
 * key in a pre-paint script to avoid a flash, so this only needs to sync the
 * icon and respond to clicks.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  // Read the theme the pre-paint script already applied.
  useEffect(() => {
    const current = (document.documentElement.getAttribute('data-theme') as Theme) || 'light';
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('osalpha-theme', next);
    } catch {
      /* storage unavailable — runtime toggle still works */
    }
    setTheme(next);
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      title="فاتح / داكن"
      aria-label="تبديل الوضع"
      aria-pressed={isDark}
      className="relative grid h-[38px] w-[38px] place-items-center rounded-full border border-osa-border bg-osa-surface text-osa-muted shadow-osa transition-colors hover:text-osa-ink"
    >
      {isDark ? (
        <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path
            strokeLinecap="round"
            d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"
          />
        </svg>
      ) : (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" d="M21 13A8.5 8.5 0 0111 3a8.5 8.5 0 1010 10z" />
        </svg>
      )}
    </button>
  );
}
