import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Cairo, Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import { coerceLocale, isLocale, dir, t } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import { SITE_URL } from '@/lib/seo';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const cairo = Cairo({ subsets: ['arabic', 'latin'], variable: '--font-arabic', display: 'swap' });

export function generateStaticParams() {
  return [{ locale: 'ar' }, { locale: 'en' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l = coerceLocale(locale);
  return {
    title: { default: l === 'ar' ? 'إيليت — نيوتك' : 'Elite — Newtech', template: '%s · Elite' },
    description: t('common.appName', l),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const direction = dir(l);

  return (
    <html lang={l} dir={direction} className={`${inter.variable} ${cairo.variable}`} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <Providers locale={l}>{children}</Providers>
      </body>
    </html>
  );
}
