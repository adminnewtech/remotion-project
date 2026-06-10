'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@elite/types';
import { Badge, PriceTag, Rating } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { localized } from '@/lib/i18n';
import { sampleProductMeta } from '@/lib/sample-data';
import type { ProductDisplay } from '@/lib/product-display';

/**
 * Catalog product card. Price/rating/image come from the optional `display`
 * prop (real, server-resolved data) or fall back to sample meta keyed by
 * product id (dev / no-env only).
 */
export function ProductCard({
  product,
  display,
}: {
  product: Product;
  display?: ProductDisplay;
}) {
  const { t, locale } = useT();
  const meta = sampleProductMeta[product.id];
  const image = display?.image ?? meta?.image ?? null;
  const price = display?.price ?? meta?.price ?? 0;
  const salePrice = display?.salePrice ?? meta?.sale_price ?? null;
  const rating = display?.rating ?? meta?.rating;
  const reviews = display?.reviews ?? meta?.reviews;

  return (
    <Link
      href={`/${locale}/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-square overflow-hidden bg-neutral-100">
        {image ? (
          <Image
            src={image}
            alt={localized(product, 'name', locale)}
            fill
            sizes="(max-width:768px) 50vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">—</div>
        )}
        <div className="absolute start-2 top-2 flex flex-col gap-1">
          {salePrice != null && salePrice < price && <Badge variant="danger">{t('catalog.onSale')}</Badge>}
          {product.requires_installation && <Badge variant="accent">{t('product.buyAndInstall')}</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {product.brand && <span className="text-xs font-medium uppercase tracking-wide text-muted">{product.brand}</span>}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{localized(product, 'name', locale)}</h3>
        {rating != null && <Rating value={rating} count={reviews} size="sm" />}
        <div className="mt-auto pt-1">
          <PriceTag price={price} salePrice={salePrice} locale={locale} />
        </div>
      </div>
    </Link>
  );
}
