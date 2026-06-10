import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { coerceLocale, localized } from '@/lib/i18n';
import { fetchProduct, fetchReviews } from '@/lib/data';
import { ProductDetail } from '@/components/product-detail';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = coerceLocale(raw);
  const product = await fetchProduct(slug);
  return { title: product ? localized(product, 'name', locale) : 'Product' };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const product = await fetchProduct(slug);
  if (!product) notFound();
  const reviews = await fetchReviews(product.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <ProductDetail product={product} reviews={reviews} />
    </div>
  );
}
