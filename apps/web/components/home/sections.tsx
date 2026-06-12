import Link from 'next/link';
import Image from 'next/image';
import type { ReactElement } from 'react';
import type { Category, Locale } from '@elite/types';
import { localized, t } from '@/lib/i18n';
import { ProductCard } from '@/components/product-card';
import { SectionHeader } from '@/components/home/section-header';
import type { ProductWithDisplay } from '@/lib/product-display';

// ── Trust / benefits bar ────────────────────────────────────────────────────

const BENEFITS: { ar: string; en: string; icon: string }[] = [
  { ar: 'ضمان سنة كاملة', en: '1-year warranty', icon: 'shield' },
  { ar: 'تركيب احترافي', en: 'Professional installation', icon: 'wrench' },
  { ar: 'توصيل خلال ٢٤ ساعة', en: '24-hour delivery', icon: 'truck' },
  { ar: 'توصيل مجاني فوق ١٠ د.ك', en: 'Free delivery over 10 KWD', icon: 'gift' },
  { ar: 'دفع آمن عبر KNET', en: 'Secure KNET payment', icon: 'card' },
];

export function TrustBar({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {BENEFITS.map((b) => (
        <div
          key={b.en}
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-primary-200 hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
            <BenefitIcon name={b.icon} />
          </span>
          <span className="text-sm font-semibold leading-tight">{ar ? b.ar : b.en}</span>
        </div>
      ))}
    </section>
  );
}

// ── Category showcase ───────────────────────────────────────────────────────

export function CategoryShowcase({
  categories,
  locale,
}: {
  categories: Category[];
  locale: Locale;
}) {
  const base = `/${locale}`;
  return (
    <section>
      <SectionHeader
        title={t('nav.categories', locale)}
        subtitle={locale === 'ar' ? 'تسوّق حسب الفئة' : 'Shop by category'}
        href={`${base}/search`}
        locale={locale}
        eyebrow={locale === 'ar' ? 'استكشف' : 'Explore'}
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`${base}/category/${c.slug}`}
            className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl border border-border bg-neutral-100 shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:aspect-square"
          >
            {c.image_url && (
              <Image
                src={c.image_url}
                alt=""
                fill
                sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 20vw"
                className="object-cover transition duration-500 group-hover:scale-110"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" aria-hidden />
            <span className="relative z-10 p-3 text-sm font-bold leading-tight text-white drop-shadow">
              {localized(c, 'name', locale)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Product rail (grid) ─────────────────────────────────────────────────────

export function ProductRail({
  title,
  subtitle,
  eyebrow,
  href,
  locale,
  items,
  priority = false,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  href?: string;
  locale: Locale;
  items: ProductWithDisplay[];
  /** Eager-load images for this rail (use for the first above-the-fold rail). */
  priority?: boolean;
}) {
  if (!items.length) return null;
  return (
    <section>
      <SectionHeader title={title} subtitle={subtitle} eyebrow={eyebrow} href={href} locale={locale} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map(({ product, display }, i) => (
          <ProductCard
            key={product.id}
            product={product}
            display={display}
            priority={priority && i < 4}
          />
        ))}
      </div>
    </section>
  );
}

// ── Offers banner ───────────────────────────────────────────────────────────

export function OffersBanner({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const base = `/${locale}`;
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-accent-600 to-primary p-8 text-white shadow-lg sm:p-12">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 90% 50%, rgba(255,255,255,0.25), transparent 40%)',
        }}
        aria-hidden
      />
      <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
            {t('offers.limitedOffer', locale)}
          </span>
          <h2 className="mt-3 text-2xl font-black sm:text-3xl">{t('offers.bundleAndSave', locale)}</h2>
          <p className="mt-1 max-w-md text-white/85">
            {ar
              ? 'اجمع المنتج مع التركيب الاحترافي ووفّر — عروض محدودة على أفضل الأجهزة.'
              : 'Pair products with professional installation and save — limited deals on top devices.'}
          </p>
        </div>
        <Link
          href={`${base}/search?sort=sale`}
          className="shrink-0 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-primary shadow-lg transition hover:bg-white/90 active:scale-95"
        >
          {t('catalog.onSale', locale)}
        </Link>
      </div>
    </section>
  );
}

// ── Brands strip ────────────────────────────────────────────────────────────

const BRANDS = ['Samsung', 'LG', 'Sony', 'Bosch', 'Apple', 'Anker', 'Xiaomi', 'Hikvision'];

export function BrandsStrip({ locale }: { locale: Locale }) {
  const base = `/${locale}`;
  return (
    <section>
      <SectionHeader title={t('catalog.brands', locale)} locale={locale} />
      <div className="flex flex-wrap gap-3">
        {BRANDS.map((b) => (
          <Link
            key={b}
            href={`${base}/search?q=${encodeURIComponent(b)}`}
            className="rounded-2xl border border-border bg-surface px-6 py-3.5 text-sm font-bold text-muted shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:text-primary hover:shadow-md"
          >
            {b}
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────

function BenefitIcon({ name }: { name: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  const paths: Record<string, ReactElement> = {
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    wrench: <path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.4-.4-2.6 2.4-2.4Z" />,
    truck: (
      <>
        <path d="M1 3h13v13H1zM14 8h4l3 3v5h-7" />
        <circle cx="5.5" cy="18.5" r="1.5" />
        <circle cx="18.5" cy="18.5" r="1.5" />
      </>
    ),
    gift: (
      <>
        <rect x="3" y="8" width="18" height="13" rx="1" />
        <path d="M12 8v13M3 12h18M12 8s-1-5-4-5-2 5 4 5Zm0 0s1-5 4-5 2 5-4 5Z" />
      </>
    ),
    card: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </>
    ),
  };
  return <svg {...common}>{paths[name] ?? paths.shield}</svg>;
}
