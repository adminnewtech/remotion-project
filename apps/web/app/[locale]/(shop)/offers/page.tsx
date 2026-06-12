import type { Metadata } from 'next';
import Link from 'next/link';
import { coerceLocale } from '@/lib/i18n';
import { fetchCategories, fetchProducts, withDisplay } from '@/lib/data';
import { fetchCatalogItems, onOfferItems } from '@/lib/feeds';
import { ProductGrid } from '@/components/product-grid';
import { CouponCard } from '@/components/growth/coupon-card';
import { absoluteUrl, breadcrumbJsonLd, JsonLd, localeAlternates } from '@/lib/seo';
import type { ProductWithDisplay } from '@/lib/product-display';

// Listing page: revalidate periodically (ISR) — sale set changes slowly.
export const revalidate = 300;

const PROMO_CODE = 'NEWTECH10';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = coerceLocale((await params).locale);
  const ar = locale === 'ar';
  const title = ar ? 'العروض والتخفيضات' : 'Offers & Deals';
  return {
    title,
    description: ar
      ? 'أقوى عروض نيوتك على الإلكترونيات الأصلية — خصومات حقيقية، باقات بتركيب احترافي، واستخدم رمز NEWTECH10.'
      : 'Newtech’s best deals on genuine electronics — real discounts, bundles with professional installation, and use code NEWTECH10.',
    alternates: { canonical: `/${locale}/offers`, languages: localeAlternates('/offers') },
    openGraph: { title, url: absoluteUrl(`/${locale}/offers`) },
  };
}

/** Heuristic: offers/bundles category by slug keyword. */
function isOffersCategorySlug(slug: string): boolean {
  return /offer|deal|bundle|sale|عرض|تخفيض/i.test(slug);
}

export default async function OffersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = coerceLocale((await params).locale);
  const ar = locale === 'ar';
  const base = `/${locale}`;

  // On-sale products across the catalog…
  const items = await fetchCatalogItems();
  const onSale = onOfferItems(items);
  const onSaleIds = new Set(onSale.map((i) => i.product.id));

  // …plus everything in any offers/bundles category.
  const categories = await fetchCategories();
  const offersCats = categories.filter((c) => isOffersCategorySlug(c.slug));
  let bundleProducts = (
    await Promise.all(offersCats.map((c) => fetchProducts({ categoryId: c.id })))
  ).flat();
  // De-dupe against on-sale and within itself.
  const seen = new Set(onSaleIds);
  bundleProducts = bundleProducts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  const onSaleDisplay: ProductWithDisplay[] = onSale.map((i) => ({
    product: i.product,
    display: {
      image: i.image,
      price: i.listPrice,
      salePrice: i.salePrice,
    },
  }));
  const bundleDisplay = await withDisplay(bundleProducts);
  const grid = [...onSaleDisplay, ...bundleDisplay];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: ar ? 'الرئيسية' : 'Home', url: absoluteUrl(base) },
          { name: ar ? 'العروض' : 'Offers', url: absoluteUrl(`${base}/offers`) },
        ])}
      />

      <nav className="flex items-center gap-2 text-sm text-muted">
        <Link href={base} className="hover:text-primary">
          {ar ? 'الرئيسية' : 'Home'}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground">{ar ? 'العروض' : 'Offers'}</span>
      </nav>

      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          {ar ? 'وفّر أكثر' : 'Save more'}
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
          {ar ? 'العروض والتخفيضات' : 'Offers & Deals'}
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          {ar
            ? 'منتجات أصلية بأسعار مخفّضة، وباقات تجمع الجهاز مع التركيب الاحترافي والضمان. عروض محدودة.'
            : 'Genuine products at reduced prices, plus bundles pairing devices with professional installation and warranty. Limited time.'}
        </p>
      </header>

      <CouponCard
        code={PROMO_CODE}
        headline={ar ? 'خصم ١٠٪ على أول طلب' : '10% off your first order'}
        sub={
          ar
            ? 'انسخ الرمز واستخدمه عند الدفع — على كل المنتجات المؤهّلة.'
            : 'Copy the code and apply it at checkout — on all eligible products.'
        }
      />

      {grid.length > 0 ? (
        <ProductGrid items={grid} />
      ) : (
        <p className="rounded-2xl border border-border bg-surface p-10 text-center text-muted">
          {ar ? 'لا توجد عروض حالياً — تابعنا قريباً.' : 'No offers right now — check back soon.'}
        </p>
      )}
    </div>
  );
}
