import Link from 'next/link';
import { coerceLocale } from '@/lib/i18n';

/**
 * Graceful "قريباً" (coming soon) placeholder for OSALPHA nav items whose
 * pages aren't built yet (الكاشير / الورشة / العملاء). Keeps the shell intact
 * instead of dead-linking to '#'.
 */
export default async function ComingSoon({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = coerceLocale(locale);
  const ar = l === 'ar';

  return (
    <div className="grid place-items-center py-24 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-osa bg-osa-brand-dim text-osa-brand">
          <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M12 7.5V12l3 2.5" />
          </svg>
        </div>
        <h2 className="text-[18px] font-bold text-osa-ink">{ar ? 'قريباً' : 'Coming soon'}</h2>
        <p className="mt-2 text-[13.5px] text-osa-muted">
          {ar
            ? 'هذه الشاشة قيد التطوير وستتوفر في تحديث قادم.'
            : 'This screen is under construction and will arrive in an upcoming release.'}
        </p>
        <Link
          href={`/${l}/admin`}
          className="osa-btn-primary mt-6 inline-flex items-center gap-2 rounded-full bg-osa-brand px-5 py-[9px] text-[13.5px] font-semibold text-white shadow-[0_4px_12px_rgba(184,134,11,.25)] transition-transform active:scale-[.97]"
        >
          {ar ? 'العودة للنظرة العامة' : 'Back to overview'}
        </Link>
      </div>
    </div>
  );
}
