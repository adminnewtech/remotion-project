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
  const description =
    l === 'ar'
      ? 'نيوتك — إلكترونيات أصلية، تركيب احترافي وتوصيل سريع في الكويت.'
      : 'Newtech — genuine electronics, professional installation and fast delivery in Kuwait.';
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: l === 'ar' ? 'نيوتك' : 'Newtech', template: '%s · Newtech' },
    description,
    applicationName: 'Newtech',
    alternates: {
      canonical: `/${l}`,
      languages: { ar: '/ar', en: '/en', 'x-default': '/ar' },
    },
    openGraph: {
      siteName: 'Newtech',
      locale: l === 'ar' ? 'ar_KW' : 'en_KW',
      type: 'website',
      url: `${SITE_URL}/${l}`,
    },
    icons: { icon: '/icon.svg' },
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
