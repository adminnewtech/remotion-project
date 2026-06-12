import { coerceLocale } from '@/lib/i18n';
import { fetchCatalog } from '@/lib/admin-catalog';
import { ProductForm } from '@/components/admin/catalog/product-form';
import { CatalogToastProvider } from '@/components/admin/catalog/shared';

/** New-product form on the OSALPHA gold design system. */
export default async function NewProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  coerceLocale(raw);
  const { categories, live } = await fetchCatalog();
  return (
    <CatalogToastProvider>
      <ProductForm product={null} categories={categories} live={live} />
    </CatalogToastProvider>
  );
}
