import { notFound } from 'next/navigation';
import { coerceLocale, localized } from '@/lib/i18n';
import { fetchCategory, fetchProducts } from '@/lib/data';
import { ProductGrid } from '@/components/product-grid';

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale = coerceLocale(raw);
  const category = await fetchCategory(slug);
  if (!category) notFound();
  const products = await fetchProducts({ categoryId: category.id });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav className="mb-2 text-sm text-muted">
        <span>{localized(category, 'name', locale)}</span>
      </nav>
      <h1 className="mb-6 text-2xl font-bold">{localized(category, 'name', locale)}</h1>
      <ProductGrid products={products} />
    </div>
  );
}
