'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth-context';
import { useT } from '@/lib/use-t';
import { ThemeToggle } from '@/components/admin/theme-toggle';

/** Formats today's date in Arabic (Gregorian + Hijri) like the mockup. */
function todayLabel(locale: string): string {
  const now = new Date();
  const loc = locale === 'ar' ? 'ar-KW' : 'en-KW';
  try {
    const greg = new Intl.DateTimeFormat(loc, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
    const hijri = new Intl.DateTimeFormat(`${loc}-u-ca-islamic-umalqura`, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
    return `${greg} · ${hijri}`;
  } catch {
    return new Intl.DateTimeFormat(loc, { dateStyle: 'full' }).format(now);
  }
}

/**
 * OSALPHA topbar: greeting + date (start), pill search (push to end), then
 * notifications, theme toggle, and the single gold primary action. The first
 * name is taken from the signed-in profile; falls back gracefully.
 */
export function AdminTopbar() {
  const { t, locale } = useT();
  const { profile } = useAuth();

  const fullName = profile?.full_name ?? (locale === 'ar' ? 'أحمد' : 'Admin');
  const firstName = fullName.split(' ')[0];
  const greeting =
    locale === 'ar'
      ? `أهلاً ${firstName} 👋 متجرك اليوم أحسن من أمس`
      : `Welcome ${firstName} 👋 today beats yesterday`;
  const searchPlaceholder =
    locale === 'ar' ? 'ابحث عن طلب، منتج، عميل...' : 'Search orders, products, customers…';
  const newOrder = locale === 'ar' ? '+ طلب جديد' : '+ New order';

  return (
    <header className="mb-[18px] flex flex-wrap items-center gap-[14px]">
      <div>
        <h1 className="text-[20px] font-bold leading-tight text-osa-ink">{greeting}</h1>
        <div className="mt-[-2px] text-[12.5px] text-osa-faint">{todayLabel(locale)}</div>
      </div>

      <div className="flex min-w-[250px] flex-1 items-center gap-[9px] rounded-full border border-osa-border bg-osa-surface px-4 py-2 text-[13px] text-osa-faint shadow-osa sm:flex-none ms-auto">
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M21 21l-4-4" />
        </svg>
        <span className="truncate">{searchPlaceholder}</span>
      </div>

      <button
        type="button"
        aria-label={t('common.notifications') || 'الإشعارات'}
        className="relative grid h-[38px] w-[38px] place-items-center rounded-full border border-osa-border bg-osa-surface text-osa-muted shadow-osa transition-colors hover:text-osa-ink"
      >
        <span className="absolute end-[10px] top-[9px] h-1.5 w-1.5 rounded-full bg-osa-rose" />
        <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" d="M18 9a6 6 0 10-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9zM10 20a2.2 2.2 0 004 0" />
        </svg>
      </button>

      <ThemeToggle />

      <Link
        href={`/${locale}/admin/orders`}
        className="osa-btn-primary flex items-center gap-2 rounded-full bg-osa-brand px-5 py-[9px] text-[13.5px] font-semibold text-white shadow-[0_4px_12px_rgba(184,134,11,.25)] transition-transform active:scale-[.97]"
      >
        {newOrder}
      </Link>
    </header>
  );
}
