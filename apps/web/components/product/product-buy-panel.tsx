'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductVariant, ProductWithVariants } from '@elite/types';
import { FREE_DELIVERY_THRESHOLD_KWD } from '@elite/types';
import { Badge, Button, PriceTag, QuantityStepper, Rating } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { localized } from '@/lib/i18n';
import { useCart } from '@/components/cart-store';

const WHATSAPP_NUMBER = '96550000000';

/**
 * Conversion-optimized buy panel (sticky on desktop). Owns the variant +
 * quantity + installation choice and reports the chosen variant up so the
 * gallery can sync to a variant image. Renders a duplicate sticky add-to-cart
 * bar on mobile (below `lg`).
 */
export function ProductBuyPanel({
  product,
  image,
  inStock = null,
  avgRating,
  reviewCount,
  onVariantChange,
}: {
  product: ProductWithVariants;
  image: string | null;
  inStock?: boolean | null;
  avgRating?: number;
  reviewCount: number;
  onVariantChange?: (variant: ProductVariant) => void;
}) {
  const { t, locale } = useT();
  const cart = useCart();
  const router = useRouter();

  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? '');
  const [withInstall, setWithInstall] = useState(product.requires_installation);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = useMemo(
    () => product.variants.find((v) => v.id === variantId) ?? product.variants[0],
    [product.variants, variantId],
  );

  const selectVariant = (v: ProductVariant) => {
    setVariantId(v.id);
    onVariantChange?.(v);
  };

  const price = variant?.price ?? 0;
  const salePrice = variant?.sale_price ?? null;
  const unitPrice = salePrice ?? price;
  const onSale = salePrice != null && salePrice < price;
  const pct = onSale ? Math.round((1 - salePrice / price) * 100) : 0;
  const soldOut = inStock === false;

  const tAttr = (key: string) => {
    const known = ['color', 'model', 'brand', 'sku'];
    return known.includes(key) ? t(`product.${key}`) : key;
  };

  const attrKeys = useMemo(() => {
    const keys = new Set<string>();
    product.variants.forEach((v) => Object.keys(v.attributes).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [product.variants]);

  function addToCart() {
    if (!variant) return;
    cart.add(
      {
        variantId: variant.id,
        productSlug: product.slug,
        nameAr: product.name_ar,
        nameEn: product.name_en,
        image,
        unitPrice,
        installationFee: product.installation_fee,
        withInstallation: withInstall,
      },
      qty,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  function buyNow() {
    addToCart();
    router.push(`/${locale}/cart`);
  }

  const waMsg =
    locale === 'ar'
      ? `مرحباً نيوتك، أريد الاستفسار عن: ${product.name_ar}`
      : `Hello Newtech, I'd like to ask about: ${product.name_en}`;
  const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMsg)}`;

  return (
    <div className="lg:sticky lg:top-24">
      {/* Brand + title */}
      {product.brand && (
        <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          {product.brand}
        </span>
      )}
      <h1 className="mt-3 text-2xl font-bold leading-snug text-foreground lg:text-3xl">
        {localized(product, 'name', locale)}
      </h1>

      {/* Rating + stock */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {avgRating != null ? (
          <Rating value={avgRating} count={reviewCount} size="sm" />
        ) : (
          <span className="text-sm text-muted">
            {locale === 'ar' ? 'كن أول من يقيّم' : 'Be the first to review'}
          </span>
        )}
        <StockPill state={soldOut ? 'out' : 'in'} t={t} />
      </div>

      {/* Price */}
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <PriceTag price={price} salePrice={salePrice} locale={locale} size="lg" />
        {onSale && (
          <Badge variant="danger" className="mb-1">
            -{pct}%
          </Badge>
        )}
      </div>
      {onSale && (
        <p className="mt-1 text-sm font-medium text-success-700">
          {t('product.save', {
            amount: `${(price - (salePrice ?? 0)).toFixed(3)} ${t('common.currency')}`,
          })}
        </p>
      )}

      {/* Variant pickers */}
      {attrKeys.map((key) => {
        const values = Array.from(
          new Set(product.variants.map((v) => v.attributes[key]).filter(Boolean)),
        );
        if (values.length <= 1) return null;
        return (
          <div key={key} className="mt-6">
            <p className="mb-2 text-sm font-bold text-foreground">{tAttr(key)}</p>
            <div className="flex flex-wrap gap-2">
              {values.map((val) => {
                const target = product.variants.find((v) => v.attributes[key] === val);
                const selected = variant?.attributes[key] === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => target && selectVariant(target)}
                    aria-pressed={selected}
                    className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                      selected
                        ? 'border-primary bg-primary-50 text-primary shadow-sm'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Buy + Install card */}
      {product.requires_installation && (
        <button
          type="button"
          onClick={() => setWithInstall((v) => !v)}
          aria-pressed={withInstall}
          className={`mt-6 block w-full rounded-2xl border p-4 text-start transition ${
            withInstall ? 'border-accent bg-accent-50 shadow-sm' : 'border-border hover:border-accent/50'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-bold text-foreground">
              <InstallIcon />
              {t('product.buyAndInstall')}
            </span>
            <span className="flex items-center gap-3">
              <span className="text-sm font-bold text-accent-700">
                +{' '}
                <PriceTag price={product.installation_fee} locale={locale} inline />
              </span>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  withInstall ? 'bg-accent' : 'bg-neutral-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    withInstall ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0.5 rtl:-translate-x-0.5'
                  }`}
                />
              </span>
            </span>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-muted">
            <li className="flex items-center gap-2">
              <CheckIcon />
              {locale === 'ar' ? 'فني تركيب محترف معتمد' : 'Professional certified technician'}
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              {locale === 'ar' ? 'تحديد موعد يناسبك' : 'Scheduled at your convenience'}
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              {locale === 'ar' ? 'اختبار وتشغيل بعد التركيب' : 'Tested and configured on site'}
            </li>
          </ul>
        </button>
      )}

      {/* Quantity + CTAs */}
      <div className="mt-6 flex items-center gap-3">
        <span className="text-sm font-bold text-foreground">
          {locale === 'ar' ? 'الكمية' : 'Qty'}
        </span>
        <QuantityStepper value={qty} onValueChange={setQty} min={1} max={20} disabled={soldOut} />
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button onClick={addToCart} size="lg" className="flex-1" disabled={soldOut}>
          {soldOut
            ? t('product.outOfStock')
            : added
              ? locale === 'ar'
                ? 'تمت الإضافة ✓'
                : 'Added ✓'
              : t('product.addToCart')}
        </Button>
        <Button onClick={buyNow} variant="accent" size="lg" className="flex-1" disabled={soldOut}>
          {t('product.buyNow')}
        </Button>
      </div>

      {/* WhatsApp ask */}
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/5 px-4 py-2.5 text-sm font-bold text-[#128C7E] transition hover:bg-[#25D366]/10"
      >
        <WhatsAppGlyph />
        {locale === 'ar' ? 'اسأل عن المنتج' : 'Ask about this product'}
      </a>

      {/* Trust rows */}
      <ul className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2">
        <TrustRow
          icon={<ShieldIcon />}
          label={t('product.warranty', { months: product.warranty_months })}
        />
        <TrustRow
          icon={<TruckIcon />}
          label={locale === 'ar' ? 'توصيل خلال 24 ساعة' : 'Delivery within 24h'}
        />
        <TrustRow
          icon={<GiftIcon />}
          label={
            locale === 'ar'
              ? `توصيل مجاني فوق ${FREE_DELIVERY_THRESHOLD_KWD} د.ك`
              : `Free delivery over ${FREE_DELIVERY_THRESHOLD_KWD} KWD`
          }
        />
        <TrustRow
          icon={<CardIcon />}
          label={locale === 'ar' ? 'دفع آمن عبر كي نت' : 'Secure KNET payment'}
        />
      </ul>

      {/* Mobile sticky add-to-cart bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <PriceTag price={price} salePrice={salePrice} locale={locale} size="md" />
          </div>
          <Button onClick={addToCart} size="lg" className="flex-[2]" disabled={soldOut}>
            {soldOut ? t('product.outOfStock') : added ? (locale === 'ar' ? '✓' : '✓') : t('product.addToCart')}
          </Button>
        </div>
      </div>
      {/* Spacer so the sticky bar never overlaps page content on mobile. */}
      <div className="h-20 lg:hidden" aria-hidden />
    </div>
  );
}

function StockPill({ state, t }: { state: 'in' | 'out'; t: (k: string) => string }) {
  if (state === 'out') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-50 px-2.5 py-1 text-xs font-bold text-danger-700">
        <Dot className="bg-danger-500" />
        {t('product.outOfStock')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-xs font-bold text-success-700">
      <Dot className="bg-success-500" />
      {t('product.inStock')}
    </span>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={`h-1.5 w-1.5 rounded-full ${className}`} aria-hidden />;
}

function TrustRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-sm font-medium text-foreground">
      <span className="text-primary">{icon}</span>
      {label}
    </li>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-accent">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function InstallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-accent">
      <path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.4-.4-2.6 2.4-2.4Z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 18V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h2" />
      <path d="M14 9h4l3 3v5a1 1 0 0 1-1 1h-1" />
      <circle cx="7.5" cy="18.5" r="1.5" />
      <circle cx="17.5" cy="18.5" r="1.5" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
      <path d="M12 8C12 8 11 2 8 2a2 2 0 0 0 0 6h4Zm0 0s1-6 4-6a2 2 0 0 1 0 6h-4Z" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.82 9.82 0 0 0 1.51 5.26l-.999 3.648 3.677-.965z" />
    </svg>
  );
}
