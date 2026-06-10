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

  const [reviews, related, inStock] = await Promise.all([
    fetchReviews(product.id),
    fetchRelatedProducts(product, 4),
    fetchInStock(product.variants.map((v) => v.id)),
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
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href={base} className="hover:text-primary">
          {locale === 'ar' ? 'الرئيسية' : 'Home'}
        </Link>
        {product.category && (
          <>
            <span aria-hidden>/</span>
            <Link href={`${base}/category/${product.category.slug}`} className="hover:text-primary">
              {categoryName}
            </Link>
          </>
        )}
      </nav>

      <ProductDetail product={product} reviews={reviews} inStock={inStock} />

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold">
            {locale === 'ar' ? 'منتجات ذات صلة' : 'Related products'}
          </h2>
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
