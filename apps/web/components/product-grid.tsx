'use client';

import { useMemo, useState } from 'react';
import { Select, EmptyState } from '@elite/ui/web';
import { ProductCard } from '@/components/product-card';
import { useT } from '@/lib/use-t';
import type { ProductWithDisplay } from '@/lib/product-display';

type SortKey = 'relevance' | 'price_low' | 'price_high' | 'rating';

/**
 * Client-side filterable product grid (brand, installation, price range, sort).
 * Operates on products already paired with their display extras (live price /
 * image), so filtering and sorting use real numbers.
 */
export function ProductGrid({ items }: { items: ProductWithDisplay[] }) {
  const { t } = useT();
  const [brand, setBrand] = useState('');
  const [needsInstall, setNeedsInstall] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [sort, setSort] = useState<SortKey>('relevance');

  const brands = useMemo(
    () => Array.from(new Set(items.map((i) => i.product.brand).filter(Boolean))) as string[],
    [items],
  );

  const priceCeiling = useMemo(
    () => Math.ceil(items.reduce((m, i) => Math.max(m, effective(i)), 0)),
    [items],
  );

  const view = useMemo(() => {
    let list = items.slice();
    if (brand) list = list.filter((i) => i.product.brand === brand);
    if (needsInstall) list = list.filter((i) => i.product.requires_installation);
    if (maxPrice !== '') list = list.filter((i) => effective(i) <= maxPrice);
    if (sort === 'price_low') list.sort((a, b) => effective(a) - effective(b));
    else if (sort === 'price_high') list.sort((a, b) => effective(b) - effective(a));
    else if (sort === 'rating')
      list.sort((a, b) => (b.display.rating ?? 0) - (a.display.rating ?? 0));
    return list;
  }, [items, brand, needsInstall, maxPrice, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          aria-label={t('catalog.filterBrand')}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="min-w-40"
        >
          <option value="">
            {t('catalog.filterBrand')}: {t('common.all')}
          </option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>

        {priceCeiling > 0 && (
          <label className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-sm">
            <span className="text-muted">{t('catalog.filterPrice')}</span>
            <input
              type="range"
              min={0}
              max={priceCeiling}
              step={1}
              value={maxPrice === '' ? priceCeiling : maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="accent-primary"
              aria-label={t('catalog.filterPrice')}
            />
            <span className="min-w-16 text-end font-medium">
              {(maxPrice === '' ? priceCeiling : maxPrice).toFixed(0)} {t('common.currency')}
            </span>
          </label>
        )}

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
          {view.map(({ product, display }) => (
            <ProductCard key={product.id} product={product} display={display} />
          ))}
        </div>
      )}
    </div>
  );
}

function effective(i: ProductWithDisplay): number {
  return i.display.salePrice ?? i.display.price;
}
