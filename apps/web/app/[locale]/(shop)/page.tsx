import type { Metadata } from 'next';
import { coerceLocale, localized, t } from '@/lib/i18n';
import { fetchCategories, fetchProducts, withDisplay } from '@/lib/data';
import { HomeHero } from '@/components/home/hero';
import {
  TrustBar,
  CategoryShowcase,
  ProductRail,
  OffersBanner,
  BrandsStrip,
} from '@/components/home/sections';
import type { ProductWithDisplay } from '@/lib/product-display';
import {
  absoluteUrl,
  JsonLd,
  localeAlternates,
  organizationJsonLd,
  websiteJsonLd,
} from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = coerceLocale(raw);
  const description =
    locale === 'ar'
      ? 'نيوتك — إلكترونيات أصلية، تركيب احترافي وتوصيل خلال ٢٤ ساعة في الكويت. ضمان سنة، توصيل مجاني للطلبات فوق ١٠ د.ك.'
      : 'Newtech — genuine electronics, professional installation and 24-hour delivery across Kuwait. 1-year warranty, free delivery over 10 KWD.';
  return {
    title:
      locale === 'ar'
        ? 'نيوتك — إلكترونيات وتركيب احترافي في الكويت'
        : 'Newtech — Electronics & Installation in Kuwait',
    description,
    alternates: { canonical: `/${locale}`, languages: localeAlternates('/') },
    openGraph: { title: 'Newtech', description, url: absoluteUrl(`/${locale}`), type: 'website' },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = coerceLocale(raw);
  const base = `/${locale}`;

  // ── Live data ─────────────────────────────────────────────
  // One broad product fetch powers featured / new / offers; per-category rails
  // are sliced from the same set (no extra round-trips, no N+1).
  const [categories, products] = await Promise.all([
    fetchCategories(),
    fetchProducts({ pageSize: 60 }),
  ]);
  const enriched = await withDisplay(products);

  const byCategory = new Map<string, ProductWithDisplay[]>();
  for (const e of enriched) {
    const cid = e.product.category_id;
    if (!cid) continue;
    const arr = byCategory.get(cid) ?? [];
    arr.push(e);
    byCategory.set(cid, arr);
  }

  const featured = enriched.slice(0, 8);
  const newArrivals = enriched.slice(8, 16).length ? enriched.slice(8, 16) : enriched.slice(0, 8);
  const offers = enriched
    .filter((e) => e.display.salePrice != null && e.display.salePrice < e.display.price)
    .slice(0, 8);

  // Pick up to two "best of category" rails: the categories (with images) that
  // have the most products, excluding ones already shown above.
  const categoryRails = categories
    .map((c) => ({ category: c, items: (byCategory.get(c.id) ?? []).slice(0, 4) }))
    .filter((r) => r.items.length >= 3)
    .sort((a, b) => (byCategory.get(b.category.id)?.length ?? 0) - (byCategory.get(a.category.id)?.length ?? 0))
    .slice(0, 2);

  const heroImage = categories[0]?.image_url ?? featured[0]?.display.image ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-6 sm:space-y-16">
      <JsonLd data={[organizationJsonLd(locale), websiteJsonLd(locale)]} />

      {/* Hero — above the fold, priority-loaded */}
      <HomeHero locale={locale} image={heroImage} />

      {/* Trust / benefits bar */}
      <TrustBar locale={locale} />

      {/* Category showcase — all categories */}
      <CategoryShowcase categories={categories} locale={locale} />

      {/* Featured — first rail eager-loads its first row */}
      <ProductRail
        title={t('catalog.featured', locale)}
        eyebrow={locale === 'ar' ? 'مختارة لك' : 'Handpicked'}
        href={`${base}/search`}
        locale={locale}
        items={featured}
        priority
      />

      {/* Offers / bundles banner */}
      <OffersBanner locale={locale} />

      {/* On sale */}
      {offers.length > 0 && (
        <ProductRail
          title={t('catalog.onSale', locale)}
          eyebrow={t('offers.dealOfTheDay', locale)}
          href={`${base}/search?sort=sale`}
          locale={locale}
          items={offers}
        />
      )}

      {/* New arrivals */}
      <ProductRail
        title={t('catalog.newArrivals', locale)}
        eyebrow={locale === 'ar' ? 'وصل حديثاً' : 'Just in'}
        href={`${base}/search`}
        locale={locale}
        items={newArrivals}
      />

      {/* Per-category "best of" rails */}
      {categoryRails.map(({ category, items }) => (
        <ProductRail
          key={category.id}
          title={localized(category, 'name', locale)}
          eyebrow={locale === 'ar' ? 'الأفضل في' : 'Best of'}
          href={`${base}/category/${category.slug}`}
          locale={locale}
          items={items}
        />
      ))}

      {/* Brands */}
      <BrandsStrip locale={locale} />
    </div>
  );
}
