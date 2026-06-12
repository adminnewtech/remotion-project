import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Cairo, Inter, IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from 'next/font/google';
import { Providers } from '@/components/providers';
import { coerceLocale, isLocale, dir, t } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import { SITE_URL } from '@/lib/seo';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const cairo = Cairo({ subsets: ['arabic', 'latin'], variable: '--font-arabic', display: 'swap' });
// OSALPHA admin typography: Cairo headings (above), IBM Plex Sans Arabic body,
// IBM Plex Mono tabular numbers. CSS vars consumed by globals.css `.osa-root`.
const cairoOsa = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-cairo',
  display: 'swap',
});
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

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
    <html
      lang={l}
      dir={direction}
      className={`${inter.variable} ${cairo.variable} ${cairoOsa.variable} ${plexArabic.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground antialiased">
        {/* OSALPHA theme: set data-theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('osalpha-theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();",
          }}
        />
        <Providers locale={l}>{children}</Providers>
      </body>
    </html>
  );
}
