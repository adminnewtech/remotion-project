'use client';

import { useMemo, useState } from 'react';
import type { Product } from '@elite/types';
import { Select, EmptyState } from '@elite/ui/web';
import { ProductCard } from '@/components/product-card';
import { useT } from '@/lib/use-t';
import { sampleProductMeta } from '@/lib/sample-data';

type SortKey = 'relevance' | 'price_low' | 'price_high' | 'rating';

/**
 * Client-side filterable product grid (brand filter, installation toggle,
 * sort). Works against passed-in products + sample display meta.
 */
export function ProductGrid({ products }: { products: Product[] }) {
  const { t } = useT();
  const [brand, setBrand] = useState('');
  const [needsInstall, setNeedsInstall] = useState(false);
  const [sort, setSort] = useState<SortKey>('relevance');

  const brands = useMemo(
    () => Array.from(new Set(products.map((p) => p.brand).filter(Boolean))) as string[],
    [products],
  );

  const view = useMemo(() => {
    let list = products.slice();
    if (brand) list = list.filter((p) => p.brand === brand);
    if (needsInstall) list = list.filter((p) => p.requires_installation);
    const priceOf = (p: Product) => {
      const m = sampleProductMeta[p.id];
      return m?.sale_price ?? m?.price ?? 0;
    };
    const ratingOf = (p: Product) => sampleProductMeta[p.id]?.rating ?? 0;
    if (sort === 'price_low') list.sort((a, b) => priceOf(a) - priceOf(b));
    else if (sort === 'price_high') list.sort((a, b) => priceOf(b) - priceOf(a));
    else if (sort === 'rating') list.sort((a, b) => ratingOf(b) - ratingOf(a));
    return list;
  }, [products, brand, needsInstall, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          aria-label={t('catalog.filterBrand')}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="min-w-40"
        >
          <option value="">{t('catalog.filterBrand')}: {t('common.all')}</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={needsInstall}
            onChange={(e) => setNeedsInstall(e.target.checked)}
            className="accent-primary"
          />
          {t('catalog.needsInstallation')}
        </label>

        <Select
          aria-label={t('common.sort')}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="ms-auto min-w-44"
        >
          <option value="relevance">{t('catalog.sortRelevance')}</option>
          <option value="price_low">{t('catalog.sortPriceLow')}</option>
          <option value="price_high">{t('catalog.sortPriceHigh')}</option>
          <option value="rating">{t('catalog.sortRating')}</option>
        </Select>
      </div>

      <p className="mb-4 text-sm text-muted">{t('catalog.resultsCount', { count: view.length })}</p>

      {view.length === 0 ? (
        <EmptyState title={t('catalog.noProducts')} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {view.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
