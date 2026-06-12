import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { coerceLocale, localized } from '@/lib/i18n';
import {
  fetchProduct,
  fetchReviews,
  fetchRelatedProducts,
  fetchInStock,
} from '@/lib/data';
import { isWishlisted } from '@/components/product/wishlist-actions';
import { ProductDetail } from '@/components/product-detail';
import { ProductCard } from '@/components/product-card';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  JsonLd,
  localeAlternates,
  productJsonLd,
} from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = coerceLocale(raw);
  const product = await fetchProduct(slug);
  if (!product) return { title: 'Product' };

  const name = localized(product, 'name', locale);
  const desc =
    localized(product, 'description', locale) ||
    (locale === 'ar'
      ? `${name} — أصلي بضمان نيوتك، تركيب احترافي وتوصيل سريع في الكويت.`
      : `${name} — genuine with Newtech warranty, professional installation and fast Kuwait delivery.`);
  const image = product.media.find((m) => m.kind === 'image')?.url;
  const path = `/${locale}/product/${slug}`;

  return {
    title: name,
    description: desc.slice(0, 160),
    alternates: { canonical: path, languages: localeAlternates(`/product/${slug}`) },
    openGraph: {
      type: 'website',
      title: name,
      description: desc.slice(0, 200),
      url: absoluteUrl(path),
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: 'summary_large_image', title: name, description: desc.slice(0, 200) },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale = coerceLocale(raw);
  const product = await fetchProduct(slug);
  if (!product) notFound();

  const [reviews, related, inStock, initialWishlisted] = await Promise.all([
    fetchReviews(product.id),
    fetchRelatedProducts(product, 4),
    fetchInStock(product.variants.map((v) => v.id)),
    isWishlisted(product.id),
  ]);

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : undefined;
  const base = `/${locale}`;
  const categoryName = product.category ? localized(product.category, 'name', locale) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <JsonLd
        data={productJsonLd(product, locale, {
          url: absoluteUrl(`${base}/product/${slug}`),
          inStock,
          avgRating,
          reviewCount: reviews.length,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: locale === 'ar' ? 'الرئيسية' : 'Home', url: absoluteUrl(base) },
            ...(product.category
              ? [
                  {
                    name: categoryName!,
                    url: absoluteUrl(`${base}/category/${product.category.slug}`),
                  },
                ]
              : []),
            { name: localized(product, 'name', locale), url: absoluteUrl(`${base}/product/${slug}`) },
          ],
        )}
      />

      {/* Breadcrumb */}
      <nav
        aria-label={locale === 'ar' ? 'مسار التنقل' : 'Breadcrumb'}
        className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted"
      >
        <Link href={base} className="transition hover:text-primary">
          {locale === 'ar' ? 'الرئيسية' : 'Home'}
        </Link>
        {product.category && (
          <>
            <Chevron />
            <Link
              href={`${base}/category/${product.category.slug}`}
              className="transition hover:text-primary"
            >
              {categoryName}
            </Link>
          </>
        )}
        <Chevron />
        <span className="line-clamp-1 max-w-[16rem] font-medium text-foreground" aria-current="page">
          {localized(product, 'name', locale)}
        </span>
      </nav>

      <ProductDetail product={product} reviews={reviews} inStock={inStock} initialWishlisted={initialWishlisted} />

      {related.length > 0 && (
        <section className="mt-14">
          <div className="mb-5 flex items-end justify-between gap-3">
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">
              {locale === 'ar' ? 'منتجات ذات صلة' : 'Related products'}
            </h2>
            {product.category && (
              <Link
                href={`${base}/category/${product.category.slug}`}
                className="shrink-0 text-sm font-bold text-primary transition hover:text-primary-700"
              >
                {locale === 'ar' ? 'عرض الكل' : 'View all'}
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map(({ product: p, display }) => (
              <ProductCard key={p.id} product={p} display={display} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0 text-neutral-300 rtl:-scale-x-100"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
