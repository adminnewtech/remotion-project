import type { Category, ProductWithVariants } from '@elite/types';
import { localized } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

/**
 * Canonical site origin. Prefers an explicit env var (set in Vercel) and falls
 * back to the live production domain so absolute URLs in metadata / JSON-LD /
 * sitemap are always correct.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://newtechq8.com'
).replace(/\/$/, '');

export const BRAND_NAME = 'Newtech';

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Render a JSON-LD <script> block. Used in server components. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function organizationJsonLd(locale: Locale): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND_NAME,
    alternateName: 'نيوتك',
    url: SITE_URL,
    logo: absoluteUrl('/icon.svg'),
    areaServed: 'KW',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'KW',
      addressRegion: locale === 'ar' ? 'الكويت' : 'Kuwait',
    },
    sameAs: ['https://www.instagram.com/newtechq8'],
  };
}

export function websiteJsonLd(locale: Locale): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND_NAME,
    url: SITE_URL,
    inLanguage: locale,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/${locale}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(
  crumbs: { name: string; url: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}

/** Product + Offer JSON-LD from a live product detail. */
export function productJsonLd(
  product: ProductWithVariants,
  locale: Locale,
  opts: { url: string; inStock: boolean | null; avgRating?: number; reviewCount?: number },
): Record<string, unknown> {
  const cheapest = product.variants.reduce<{ price: number; sale: number | null } | null>(
    (best, v) => {
      const eff = v.sale_price != null && v.sale_price < v.price ? v.sale_price : v.price;
      if (!best || eff < (best.sale ?? best.price)) return { price: v.price, sale: v.sale_price };
      return best;
    },
    null,
  );
  const price = cheapest ? (cheapest.sale ?? cheapest.price) : 0;
  const image = product.media.filter((m) => m.kind === 'image').map((m) => m.url);

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: localized(product, 'name', locale),
    description: localized(product, 'description', locale),
    sku: product.variants[0]?.sku ?? product.id,
    image: image.length ? image : undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    category: product.category ? localized(product.category, 'name', locale) : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'KWD',
      price: price.toFixed(3),
      url: opts.url,
      availability:
        opts.inStock === false
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: BRAND_NAME },
    },
  };

  if (opts.avgRating && opts.reviewCount) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: opts.avgRating.toFixed(1),
      reviewCount: opts.reviewCount,
    };
  }

  return data;
}

/** hreflang alternates map for a path that exists in both locales. */
export function localeAlternates(pathWithoutLocale: string): Record<string, string> {
  const clean = pathWithoutLocale.startsWith('/')
    ? pathWithoutLocale
    : `/${pathWithoutLocale}`;
  return {
    ar: `/ar${clean === '/' ? '' : clean}`,
    en: `/en${clean === '/' ? '' : clean}`,
  };
}

export function categoryAlternates(slug: string, locale: Locale, _cat?: Category) {
  void locale;
  return localeAlternates(`/category/${slug}`);
}
