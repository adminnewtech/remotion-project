import type { Metadata } from 'next';
import Link from 'next/link';
import { coerceLocale } from '@/lib/i18n';
import { fetchCatalogItems, brandIndex } from '@/lib/feeds';
import { absoluteUrl, breadcrumbJsonLd, JsonLd, localeAlternates } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = coerceLocale((await params).locale);
  const ar = locale === 'ar';
  const title = ar ? 'العلامات التجارية' : 'Brands';
  return {
    title,
    description: ar
      ? 'تصفّح كل العلامات التجارية المتوفّرة في نيوتك — سامسونج، إل جي، سوني والمزيد، بمنتجات أصلية وضمان.'
      : 'Browse every brand at Newtech — Samsung, LG, Sony and more, with genuine products and warranty.',
    alternates: { canonical: `/${locale}/brands`, languages: localeAlternates('/brands') },
    openGraph: { title, url: absoluteUrl(`/${locale}/brands`) },
  };
}

/** Initials badge for a brand with no logo asset. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default async function BrandsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = coerceLocale((await params).locale);
  const ar = locale === 'ar';
  const base = `/${locale}`;

  const items = await fetchCatalogItems();
  const brands = brandIndex(items);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: ar ? 'الرئيسية' : 'Home', url: absoluteUrl(base) },
          { name: ar ? 'العلامات التجارية' : 'Brands', url: absoluteUrl(`${base}/brands`) },
        ])}
      />

      <nav className="flex items-center gap-2 text-sm text-muted">
        <Link href={base} className="hover:text-primary">
          {ar ? 'الرئيسية' : 'Home'}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground">{ar ? 'العلامات التجارية' : 'Brands'}</span>
      </nav>

      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          {ar ? 'تسوّق حسب العلامة' : 'Shop by brand'}
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
          {ar ? 'العلامات التجارية' : 'Brands'}
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          {ar
            ? 'كل العلامات التجارية المتوفّرة لدينا — منتجات أصلية بضمان وتركيب احترافي.'
            : 'Every brand we carry — genuine products with warranty and professional installation.'}
        </p>
      </header>

      {brands.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-10 text-center text-muted">
          {ar ? 'لا توجد علامات تجارية بعد.' : 'No brands yet.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {brands.map((b) => (
            <Link
              key={b.name}
              href={`${base}/search?q=${encodeURIComponent(b.name)}`}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center shadow-sm transition hover:-translate-y-1 hover:border-primary-200 hover:shadow-xl"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-accent-50 text-xl font-black text-primary transition group-hover:scale-105">
                {initials(b.name)}
              </span>
              <span className="text-base font-bold leading-tight text-foreground transition group-hover:text-primary">
                {b.name}
              </span>
              <span className="text-xs font-semibold text-muted">
                {ar
                  ? `${b.count} ${b.count === 1 ? 'منتج' : 'منتجات'}`
                  : `${b.count} ${b.count === 1 ? 'product' : 'products'}`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
