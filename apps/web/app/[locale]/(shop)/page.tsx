import Link from 'next/link';
import Image from 'next/image';
import type { ReactElement } from 'react';
import type { Metadata } from 'next';
import { coerceLocale, localized, t } from '@/lib/i18n';
import { fetchCategories, fetchProducts, withDisplay } from '@/lib/data';
import { ProductCard } from '@/components/product-card';
import { SearchBar } from '@/components/search-bar';
import {
  absoluteUrl,
  JsonLd,
  localeAlternates,
  organizationJsonLd,
  websiteJsonLd,
} from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = coerceLocale(raw);
  const description =
    locale === 'ar'
      ? 'نيوتك — إلكترونيات أصلية، تركيب احترافي وتوصيل خلال ٢٤ ساعة في الكويت. ضمان سنة، توصيل مجاني للطلبات فوق ١٠ د.ك.'
      : 'Newtech — genuine electronics, professional installation and 24-hour delivery across Kuwait. 1-year warranty, free delivery over 10 KWD.';
  return {
    title: locale === 'ar' ? 'نيوتك — إلكترونيات وتركيب احترافي في الكويت' : 'Newtech — Electronics & Installation in Kuwait',
    description,
    alternates: { canonical: `/${locale}`, languages: localeAlternates('/') },
    openGraph: { title: 'Newtech', description, url: absoluteUrl(`/${locale}`), type: 'website' },
  };
}

const BRANDS = ['Samsung', 'LG', 'Sony', 'Bosch', 'Apple', 'Anker', 'Xiaomi', 'Hikvision'];

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = coerceLocale(raw);
  const base = `/${locale}`;
  const ar = locale === 'ar';

  const [categories, products] = await Promise.all([fetchCategories(), fetchProducts()]);
  const enriched = await withDisplay(products);

  const featured = enriched.slice(0, 8);
  const newArrivals = enriched.slice(8, 16).length ? enriched.slice(8, 16) : enriched.slice(0, 8);
  const offers = enriched.filter((e) => e.display.salePrice != null && e.display.salePrice < e.display.price).slice(0, 8);

  const benefits = [
    { ar: 'ضمان سنة كاملة', en: '1-year warranty', icon: 'shield' },
    { ar: 'تركيب احترافي', en: 'Professional installation', icon: 'wrench' },
    { ar: 'توصيل خلال ٢٤ ساعة', en: '24-hour delivery', icon: 'truck' },
    { ar: 'توصيل مجاني فوق ١٠ د.ك', en: 'Free delivery over 10 KWD', icon: 'gift' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <JsonLd data={[organizationJsonLd(locale), websiteJsonLd(locale)]} />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-primary text-white">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 80% 20%, rgba(6,182,212,0.55), transparent 45%), radial-gradient(circle at 10% 90%, rgba(129,140,248,0.5), transparent 40%)',
          }}
          aria-hidden
        />
        <div className="relative grid items-center gap-6 p-8 md:grid-cols-2 md:p-12">
          <div>
            <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              {ar ? 'توصيل خلال ٢٤ ساعة في الكويت' : '24-hour delivery across Kuwait'}
            </span>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight md:text-5xl">
              {ar ? 'إلكترونيات أصلية مع تركيب احترافي' : 'Genuine electronics with professional installation'}
            </h1>
            <p className="mt-3 max-w-md text-white/80">
              {ar
                ? 'اشترِ، ركّب، وتتبّع طلبك مباشرة — كل ذلك من مكان واحد.'
                : 'Buy, install and track your order live — all in one place.'}
            </p>
            <div className="mt-6 max-w-md">
              <SearchBar />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`${base}/search`} className="rounded-full bg-white px-6 py-3 text-sm font-bold text-primary transition hover:bg-white/90">
                {t('catalog.title', locale)}
              </Link>
              <Link href={`${base}/search?sort=offers`} className="rounded-full border border-white/40 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                {t('catalog.onSale', locale)}
              </Link>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/20 shadow-2xl">
              <Image
                src={categories[0]?.image_url ?? 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=900&q=70'}
                alt=""
                fill
                className="object-cover"
                sizes="50vw"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {benefits.map((b) => (
          <div key={b.en} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <BenefitIcon name={b.icon} />
            <span className="text-sm font-semibold leading-tight">{ar ? b.ar : b.en}</span>
          </div>
        ))}
      </section>

      {/* Categories — all */}
      <section className="mt-10">
        <SectionHeader title={t('nav.categories', locale)} href={`${base}/search`} locale={locale} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`${base}/category/${c.slug}`}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative h-16 w-16 overflow-hidden rounded-full bg-neutral-100">
                {c.image_url && <Image src={c.image_url} alt="" fill className="object-cover" sizes="64px" />}
              </div>
              <span className="text-xs font-semibold leading-tight">{localized(c, 'name', locale)}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <ProductRow title={t('catalog.featured', locale)} href={`${base}/search`} locale={locale} items={featured} />

      {/* Offers */}
      {offers.length > 0 && (
        <ProductRow title={t('catalog.onSale', locale)} href={`${base}/search`} locale={locale} items={offers} />
      )}

      {/* New arrivals */}
      <ProductRow title={t('catalog.newArrivals', locale)} href={`${base}/search`} locale={locale} items={newArrivals} />

      {/* Brand strip */}
      <section className="mt-12">
        <h2 className="mb-4 text-xl font-bold">{t('catalog.brands', locale)}</h2>
        <div className="flex flex-wrap gap-3">
          {BRANDS.map((b) => (
            <Link
              key={b}
              href={`${base}/search?q=${encodeURIComponent(b)}`}
              className="rounded-2xl border border-border bg-surface px-5 py-3 text-sm font-bold text-muted shadow-sm transition hover:border-primary hover:text-primary"
            >
              {b}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ title, href, locale }: { title: string; href: string; locale: 'ar' | 'en' }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xl font-bold">{title}</h2>
      <Link href={href} className="text-sm font-semibold text-primary hover:underline">
        {t('common.seeAll', locale)}
      </Link>
    </div>
  );
}

function ProductRow({
  title,
  href,
  locale,
  items,
}: {
  title: string;
  href: string;
  locale: 'ar' | 'en';
  items: { product: import('@elite/types').Product; display: import('@/lib/product-display').ProductDisplay }[];
}) {
  if (!items.length) return null;
  return (
    <section className="mt-10">
      <SectionHeader title={title} href={href} locale={locale} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map(({ product, display }) => (
          <ProductCard key={product.id} product={product} display={display} />
        ))}
      </div>
    </section>
  );
}

function BenefitIcon({ name }: { name: string }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  const paths: Record<string, ReactElement> = {
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    wrench: <path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.4-.4-2.6 2.4-2.4Z" />,
    truck: <><path d="M1 3h13v13H1zM14 8h4l3 3v5h-7" /><circle cx="5.5" cy="18.5" r="1.5" /><circle cx="18.5" cy="18.5" r="1.5" /></>,
    gift: <><rect x="3" y="8" width="18" height="13" rx="1" /><path d="M12 8v13M3 12h18M12 8s-1-5-4-5-2 5 4 5Zm0 0s1-5 4-5 2 5-4 5Z" /></>,
  };
  return (
    <span className="text-primary">
      <svg {...common}>{paths[name] ?? paths.shield}</svg>
    </span>
  );
}
