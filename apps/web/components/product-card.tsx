'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import type { Product } from '@elite/types';
import { Badge, PriceTag, Rating } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { localized } from '@/lib/i18n';
import { sampleProductMeta } from '@/lib/sample-data';
import type { ProductDisplay } from '@/lib/product-display';

/**
 * Premium catalog product card.
 *
 * Layout (RTL-safe via logical properties):
 *  - Fixed `aspect-square` image container on a subtle neutral background so
 *    cards never shift while images load. The product photo uses
 *    `object-contain` (catalog photos vary wildly in aspect ratio) and a
 *    next/image `fill` + `sizes` setup with a blur-up placeholder + skeleton.
 *  - Name renders BELOW the image (never overlapping). Brand, rating,
 *    stock hint, price (+ strikethrough sale), a "Buy + Install" badge, and a
 *    quick add-to-cart affordance that routes to the product page (where a
 *    concrete variant + installation choice can be made).
 *
 * Price / image / rating come from the server-resolved `display` prop; sample
 * meta keyed by product id is the dev / no-env fallback only.
 */
export function ProductCard({
  product,
  display,
  priority = false,
}: {
  product: Product;
  display?: ProductDisplay;
  /** Eager-load the image (above-the-fold rows only). */
  priority?: boolean;
}) {
  const { t, locale } = useT();
  const meta = sampleProductMeta[product.id];
  const image = display?.image ?? meta?.image ?? null;
  const price = display?.price ?? meta?.price ?? 0;
  const salePrice = display?.salePrice ?? meta?.sale_price ?? null;
  const rating = display?.rating ?? meta?.rating;
  const reviews = display?.reviews ?? meta?.reviews;
  const lowStock = display?.lowStock ?? null;

  const [loaded, setLoaded] = useState(false);
  const name = localized(product, 'name', locale);
  const onSale = salePrice != null && salePrice < price;
  const pct = onSale ? Math.round((1 - (salePrice as number) / price) * 100) : 0;
  const href = `/${locale}/product/${product.slug}`;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-xl">
      {/* Image */}
      <Link
        href={href}
        aria-label={name}
        className="relative block aspect-square overflow-hidden bg-gradient-to-br from-neutral-50 to-neutral-100"
      >
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
            placeholder="empty"
            priority={priority}
            loading={priority ? undefined : 'lazy'}
            onLoad={() => setLoaded(true)}
            className={`object-contain p-4 transition duration-500 group-hover:scale-105 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl text-neutral-300">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-4.35-4.35a2 2 0 0 0-2.83 0L3 21" />
            </svg>
          </div>
        )}
        {/* Skeleton shimmer until the image paints — reserves space, no CLS. */}
        {image && !loaded && (
          <div className="absolute inset-0 animate-pulse bg-neutral-100" aria-hidden />
        )}

        {/* Badges */}
        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-1">
          <div className="flex flex-col gap-1">
            {onSale && (
              <Badge variant="danger" className="shadow-sm">
                -{pct}%
              </Badge>
            )}
            {product.requires_installation && (
              <Badge variant="accent" className="shadow-sm">
                <InstallIcon />
                {t('product.buyAndInstall')}
              </Badge>
            )}
          </div>
        </div>
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        {product.brand && (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {product.brand}
          </span>
        )}
        <Link href={href} className="transition hover:text-primary">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground">
            {name}
          </h3>
        </Link>

        {rating != null && (
          <div className="flex items-center gap-1">
            <Rating value={rating} count={reviews} size="sm" />
          </div>
        )}

        {/* Stock hint */}
        {lowStock != null && lowStock > 0 && lowStock <= 5 && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-warning-100 px-2 py-0.5 text-[11px] font-semibold text-warning-700">
            {t('product.lowStock', { count: lowStock })}
          </span>
        )}

        {/* Price + CTA pinned to the bottom */}
        <div className="mt-auto space-y-2 pt-2">
          <PriceTag price={price} salePrice={salePrice} locale={locale} size="md" />
          <Link
            href={href}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700 active:scale-[0.98]"
          >
            <CartIcon />
            {t('product.addToCart')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function CartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function InstallIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.4-.4-2.6 2.4-2.4Z" />
    </svg>
  );
}
