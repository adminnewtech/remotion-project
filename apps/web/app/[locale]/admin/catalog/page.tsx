import { coerceLocale } from '@/lib/i18n';
import { fetchCatalog } from '@/lib/admin-catalog';
import { CatalogList } from '@/components/admin/catalog/catalog-list';
import { CatalogToastProvider } from '@/components/admin/catalog/shared';

/**
 * OSALPHA products list — gold DataTable + KPIs. Reads the catalog data seam
 * (live `@elite/core` catalog.listProducts + inventory; sample fallback).
 */
export default async function AdminCatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  coerceLocale(raw);
  const data = await fetchCatalog();
  return (
    <CatalogToastProvider>
      <CatalogList data={data} />
    </CatalogToastProvider>
  );
}
