import Link from 'next/link';
import { DEFAULT_LOCALE, t } from '@/lib/i18n';

export default function NotFound() {
  const locale = DEFAULT_LOCALE;
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-black text-primary">404</p>
      <p className="text-lg font-semibold">{t('common.notFound', locale)}</p>
      <Link href={`/${locale}`} className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white">
        {t('nav.home', locale)}
      </Link>
    </div>
  );
}
