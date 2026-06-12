import type { Metadata } from 'next';
import { coerceLocale, t } from '@/lib/i18n';
import { fetchProductsWithDisplay } from '@/lib/data';
import { ProductGrid } from '@/components/product-grid';
import { SearchBar } from '@/components/search-bar';
import { localeAlternates } from '@/lib/seo';

// ISR for the no-query catalog browse; query results stay fresh via searchParams.
export const revalidate = 300;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const { q } = await searchParams;
  const locale = coerceLocale(raw);
  const title = q ? `${t('common.search', locale)}: ${q}` : t('catalog.title', locale);
  return {
    title,
    description:
      locale === 'ar'
        ? 'تصفّح كل منتجات نيوتك — إلكترونيات أصلية بأسعار تنافسية وتوصيل سريع.'
        : 'Browse the full Newtech catalog — genuine electronics at great prices with fast delivery.',
    alternates: { canonical: `/${locale}/search`, languages: localeAlternates('/search') },
    robots: q ? { index: false, follow: true } : undefined,
  };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale: raw } = await params;
  const { q } = await searchParams;
  const locale = coerceLocale(raw);
  const items = await fetchProductsWithDisplay(q ? { search: q } : {});

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-3 text-2xl font-bold">{t('catalog.title', locale)}</h1>
      <div className="mb-5 max-w-xl">
        <SearchBar />
      </div>
      {q && (
        <p className="mb-5 text-sm text-muted">
          {t('catalog.resultsCount', locale, { count: items.length })} · “{q}”
        </p>
      )}
      <ProductGrid items={items} />
    </div>
  );
}
