import { coerceLocale } from '@/lib/i18n';
import { fetchProducts, fetchCategories } from '@/lib/data';
import { CatalogManager } from '@/components/admin/catalog-manager';

export default async function AdminCatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  coerceLocale(raw);
  const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);
  return <CatalogManager products={products} categories={categories} />;
}
