'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import type { ProductWithVariants, Review } from '@elite/types';
import { Badge, Button, PriceTag, Rating, StatusBadge } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { localized } from '@/lib/i18n';
import { useCart } from '@/components/cart-store';

/** Interactive product detail: gallery, variant select, Buy+Install, reviews. */
export function ProductDetail({
  product,
  reviews,
}: {
  product: ProductWithVariants;
  reviews: Review[];
}) {
  const { t, locale } = useT();
  const cart = useCart();

  const images = product.media.filter((m) => m.kind === 'image');
  const [activeImg, setActiveImg] = useState(0);
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? '');
  const [withInstall, setWithInstall] = useState(product.requires_installation);
  const [added, setAdded] = useState(false);

  const variant = useMemo(
    () => product.variants.find((v) => v.id === variantId) ?? product.variants[0],
    [product.variants, variantId],
  );

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : undefined;

  const price = variant?.price ?? 0;
  const salePrice = variant?.sale_price ?? null;
  const unitPrice = salePrice ?? price;

  // Collect distinct attribute keys/values for variant pickers.
  const attrKeys = useMemo(() => {
    const keys = new Set<string>();
    product.variants.forEach((v) => Object.keys(v.attributes).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [product.variants]);

  function addToCart() {
    if (!variant) return;
    cart.add({
      variantId: variant.id,
      productSlug: product.slug,
      nameAr: product.name_ar,
      nameEn: product.name_en,
      image: images[0]?.url ?? null,
      unitPrice,
      installationFee: product.installation_fee,
      withInstallation: withInstall,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Gallery */}
      <div>
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-neutral-100">
          {images[activeImg] && (
            <Image
              src={images[activeImg]!.url}
              alt={localized(product, 'name', locale)}
              fill
              sizes="(max-width:1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          )}
        </div>
        {images.length > 1 && (
          <div className="mt-3 flex gap-2">
            {images.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveImg(i)}
                className={`relative h-16 w-16 overflow-hidden rounded-lg border ${i === activeImg ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
              >
                <Image src={m.url} alt="" fill className="object-cover" sizes="64px" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div>
        {product.brand && (
          <span className="text-sm font-semibold uppercase tracking-wide text-muted">{product.brand}</span>
        )}
        <h1 className="mt-1 text-2xl font-bold leading-snug">{localized(product, 'name', locale)}</h1>

        <div className="mt-2 flex items-center gap-3">
          {avgRating != null && <Rating value={avgRating} count={reviews.length} />}
          <StatusBadge status="paid" labelOverride={t('product.inStock')} />
        </div>

        <div className="mt-4">
          <PriceTag price={price} salePrice={salePrice} locale={locale} size="lg" />
        </div>

        <Badge variant="info" className="mt-3">
          {t('product.warranty', { months: product.warranty_months })}
        </Badge>

        {/* Variant pickers */}
        {attrKeys.map((key) => {
          const values = Array.from(new Set(product.variants.map((v) => v.attributes[key]).filter(Boolean)));
          if (values.length <= 1) return null;
          return (
            <div key={key} className="mt-5">
              <p className="mb-2 text-sm font-semibold">{t(`product.${key}`) || key}</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${v.id === variantId ? 'border-primary bg-primary-50 text-primary' : 'border-border hover:border-primary/50'}`}
                  >
                    {v.attributes[key]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Buy + Install toggle */}
        {product.requires_installation && (
          <button
            type="button"
            onClick={() => setWithInstall((v) => !v)}
            aria-pressed={withInstall}
            className={`mt-6 flex w-full items-center justify-between rounded-2xl border p-4 text-start transition ${withInstall ? 'border-accent bg-accent-50' : 'border-border'}`}
          >
            <span>
              <span className="block text-sm font-bold">{t('product.buyAndInstall')}</span>
              <span className="block text-xs text-muted">{t('product.addInstallation')}</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="text-sm font-bold text-accent-700">
                + <PriceTag price={product.installation_fee} locale={locale} inline />
              </span>
              <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${withInstall ? 'bg-accent' : 'bg-neutral-300'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${withInstall ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0.5'}`} />
              </span>
            </span>
          </button>
        )}

        {/* Add to cart */}
        <div className="mt-6 flex gap-3">
          <Button onClick={addToCart} size="lg" className="flex-1">
            {added ? t('common.ok') : t('product.addToCart')}
          </Button>
          <Button onClick={addToCart} variant="accent" size="lg" className="flex-1">
            {t('product.buyNow')}
          </Button>
        </div>

        {/* Description */}
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-bold">{t('product.description')}</h2>
          <p className="text-sm leading-relaxed text-muted">{localized(product, 'description', locale)}</p>
        </section>

        {/* Specs */}
        {variant && (
          <section className="mt-6">
            <h2 className="mb-2 text-lg font-bold">{t('product.specifications')}</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between rounded-lg bg-neutral-50 px-3 py-2">
                <dt className="text-muted">{t('product.sku')}</dt>
                <dd className="font-medium">{variant.sku ?? '—'}</dd>
              </div>
              {Object.entries(variant.attributes).map(([k, v]) => (
                <div key={k} className="flex justify-between rounded-lg bg-neutral-50 px-3 py-2">
                  <dt className="text-muted">{t(`product.${k}`) || k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>

      {/* Reviews (full width) */}
      <section className="lg:col-span-2">
        <h2 className="mb-4 text-lg font-bold">{t('product.reviews')}</h2>
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <Rating value={r.rating} size="sm" />
              {r.body && <p className="mt-2 text-sm">{r.body}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
