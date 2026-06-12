'use client';

import { useMemo, useState } from 'react';
import type { Locale, ProductVariant, ProductWithVariants, Review } from '@elite/types';
import { Tabs } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { localized } from '@/lib/i18n';
import { ProductGallery, type GalleryImage } from '@/components/product/product-gallery';
import { ProductBuyPanel } from '@/components/product/product-buy-panel';
import { ProductReviews } from '@/components/product/product-reviews';

/**
 * PDP orchestrator. Lays out the gallery (start column) and the sticky buy
 * panel (end column), keeps them in sync (selecting a variant that has its own
 * media jumps the gallery to it), then renders description, specs tabs, and
 * the reviews scaffold full-width below.
 *
 * Server-resolved data only; all interactivity lives in the leaf client
 * components (gallery zoom/lightbox, variant/qty/cart in the buy panel).
 */
export function ProductDetail({
  product,
  reviews,
  inStock = null,
}: {
  product: ProductWithVariants;
  reviews: Review[];
  inStock?: boolean | null;
}) {
  const { t, locale } = useT();

  const imageMedia = useMemo(
    () => product.media.filter((m) => m.kind === 'image'),
    [product.media],
  );
  const images: GalleryImage[] = useMemo(
    () => imageMedia.map((m) => ({ id: m.id, url: m.url })),
    [imageMedia],
  );

  const [activeIndex, setActiveIndex] = useState(0);

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : undefined;

  // When a variant with its own media is chosen, jump the gallery to it.
  const onVariantChange = (variant: ProductVariant) => {
    const idx = imageMedia.findIndex((m) => m.variant_id === variant.id);
    if (idx >= 0) setActiveIndex(idx);
  };

  const description = localized(product, 'description', locale);

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery
          images={images}
          alt={localized(product, 'name', locale)}
          activeIndex={activeIndex}
          onActiveChange={setActiveIndex}
        />

        <ProductBuyPanel
          product={product}
          image={images[0]?.url ?? null}
          inStock={inStock}
          avgRating={avgRating}
          reviewCount={reviews.length}
          onVariantChange={onVariantChange}
        />
      </div>

      <DetailsSection product={product} description={description} t={t} locale={locale} />

      <ProductReviews reviews={reviews} productId={product.id} />
    </>
  );
}

function DetailsSection({
  product,
  description,
  t,
  locale,
}: {
  product: ProductWithVariants;
  description: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
}) {
  const [tab, setTab] = useState<'description' | 'specs'>('description');

  return (
    <section className="mt-12">
      <Tabs
        items={[
          { value: 'description', label: t('product.description') },
          { value: 'specs', label: t('product.specifications') },
        ]}
        value={tab}
        onValueChange={(v) => setTab(v as 'description' | 'specs')}
        variant="underline"
      />

      <div className="mt-6">
        {tab === 'description' ? (
          <Description product={product} description={description} t={t} locale={locale} />
        ) : (
          <Specs product={product} t={t} locale={locale} />
        )}
      </div>
    </section>
  );
}

function Description({
  product,
  description,
  t,
  locale,
}: {
  product: ProductWithVariants;
  description: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
}) {
  if (description && description.trim()) {
    // Marketing copy as well-typographed rich text: paragraphs split on blank
    // lines, soft breaks preserved. Generous leading, RTL-safe (logical flow).
    const paragraphs = description.split(/\n{2,}/).filter((p) => p.trim());
    return (
      <div className="max-w-3xl space-y-4 text-[15px] leading-8 text-foreground/90">
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p.trim()}
          </p>
        ))}
      </div>
    );
  }

  // Tasteful fallback when description is absent — highlight key facts.
  const name = localized(product, 'name', locale);
  const points = [
    product.brand &&
      (locale === 'ar' ? `علامة ${product.brand} الأصلية` : `Genuine ${product.brand} product`),
    t('product.warranty', { months: product.warranty_months }),
    product.requires_installation
      ? locale === 'ar'
        ? 'تركيب احترافي متاح من نيوتك'
        : 'Professional installation available from Newtech'
      : null,
    locale === 'ar' ? 'توصيل سريع داخل الكويت' : 'Fast delivery across Kuwait',
  ].filter(Boolean) as string[];

  return (
    <div className="max-w-3xl">
      <p className="text-[15px] leading-8 text-foreground/90">
        {locale === 'ar'
          ? `${name} متوفر الآن لدى نيوتك بأفضل قيمة في الكويت.`
          : `${name} is available now at Newtech with the best value in Kuwait.`}
      </p>
      <ul className="mt-4 space-y-2">
        {points.map((pt, i) => (
          <li key={i} className="flex items-start gap-2 text-[15px] text-foreground/90">
            <CheckIcon />
            <span>{pt}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Specs({
  product,
  t,
  locale,
}: {
  product: ProductWithVariants;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
}) {
  const tAttr = (key: string) =>
    ['color', 'model', 'brand', 'sku'].includes(key) ? t(`product.${key}`) : key;

  const skus = Array.from(new Set(product.variants.map((v) => v.sku).filter(Boolean))) as string[];

  // Union of attribute keys → distinct values across variants.
  const attrRows: (readonly [string, string])[] = (() => {
    const map = new Map<string, Set<string>>();
    product.variants.forEach((v) =>
      Object.entries(v.attributes).forEach(([k, val]) => {
        if (!map.has(k)) map.set(k, new Set());
        map.get(k)!.add(val);
      }),
    );
    return Array.from(map.entries()).map(
      ([k, set]) => [tAttr(k), Array.from(set).join('، ')] as const,
    );
  })();

  const rows: (readonly [string, string])[] = [
    ...(product.brand ? [[t('product.brand'), product.brand] as const] : []),
    [
      locale === 'ar' ? 'الضمان' : 'Warranty',
      locale === 'ar' ? `${product.warranty_months} شهراً` : `${product.warranty_months} months`,
    ],
    [
      locale === 'ar' ? 'التركيب' : 'Installation',
      product.requires_installation
        ? locale === 'ar'
          ? 'متاح (رسوم إضافية)'
          : 'Available (extra fee)'
        : locale === 'ar'
          ? 'غير مطلوب'
          : 'Not required',
    ],
    ...(product.category
      ? ([[locale === 'ar' ? 'الفئة' : 'Category', localized(product.category, 'name', locale)]] as const)
      : []),
    ...(skus.length ? [[t('product.sku'), skus.join('، ')] as const] : []),
    ...attrRows,
  ];

  return (
    <dl className="max-w-3xl divide-y divide-border overflow-hidden rounded-2xl border border-border">
      {rows.map(([k, v], i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 px-4 py-3 odd:bg-neutral-50/60"
        >
          <dt className="text-sm text-muted">{k}</dt>
          <dd className="text-sm font-semibold text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="mt-0.5 shrink-0 text-accent"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
