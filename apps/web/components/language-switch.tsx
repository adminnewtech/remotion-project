'use client';

/**
 * Instant language switch. Swaps the leading /ar or /en segment in the current
 * path, persists the choice in a cookie, and navigates — the locale layout
 * re-renders with the new lang/dir.
 */
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from '@/components/providers';
import type { Locale } from '@/lib/i18n';

export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { locale } = useLocale();
  const router = useRouter();
  const pathname = usePathname() || `/${locale}`;

  function switchTo(next: Locale) {
    if (next === locale) return;
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    const segments = pathname.split('/');
    segments[1] = next; // replace leading locale segment
    router.push(segments.join('/') || `/${next}`);
  }

  return (
    <div className={`inline-flex items-center rounded-full border border-border bg-surface p-0.5 text-sm ${className}`}>
      <button
        type="button"
        onClick={() => switchTo('ar')}
        aria-pressed={locale === 'ar'}
        className={`rounded-full px-3 py-1 transition ${locale === 'ar' ? 'bg-primary text-white' : 'text-muted hover:text-foreground'}`}
      >
        ع
      </button>
      <button
        type="button"
        onClick={() => switchTo('en')}
        aria-pressed={locale === 'en'}
        className={`rounded-full px-3 py-1 transition ${locale === 'en' ? 'bg-primary text-white' : 'text-muted hover:text-foreground'}`}
      >
        EN
      </button>
    </div>
  );
}
