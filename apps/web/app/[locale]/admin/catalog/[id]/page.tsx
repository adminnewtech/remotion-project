import { notFound } from 'next/navigation';
import { coerceLocale } from '@/lib/i18n';
import { fetchCatalog, fetchCatalogProduct } from '@/lib/admin-catalog';
import { ProductForm } from '@/components/admin/catalog/product-form';
import { CatalogToastProvider } from '@/components/admin/catalog/shared';

/** Edit-product form on the OSALPHA gold design system. */
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  coerceLocale(raw);
  const [{ categories }, { product, live }] = await Promise.all([
    fetchCatalog(),
    fetchCatalogProduct(id),
  ]);
  if (!product) notFound();
  return (
    <CatalogToastProvider>
      <ProductForm product={product} categories={categories} live={live} />
    </CatalogToastProvider>
  );
}
