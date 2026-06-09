import { coerceLocale, t } from '@/lib/i18n';
import { fetchProducts } from '@/lib/data';
import { ProductGrid } from '@/components/product-grid';

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale: raw } = await params;
  const { q } = await searchParams;
  const locale = coerceLocale(raw);
  const products = await fetchProducts(q ? { search: q } : {});

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold">{t('catalog.title', locale)}</h1>
      {q && <p className="mb-5 text-sm text-muted">“{q}”</p>}
      <ProductGrid products={products} />
    </div>
  );
}
