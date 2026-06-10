import Link from 'next/link';
import Image from 'next/image';
import { coerceLocale, localized, t } from '@/lib/i18n';
import { fetchCategories, fetchProducts } from '@/lib/data';
import { ProductCard } from '@/components/product-card';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = coerceLocale(raw);
  const base = `/${locale}`;
  const [categories, products] = await Promise.all([fetchCategories(), fetchProducts()]);
  const featured = products.slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
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
              {locale === 'ar' ? 'توصيل خلال ٢٤ ساعة في الكويت' : '24-hour delivery across Kuwait'}
            </span>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight md:text-5xl">
              {locale === 'ar' ? 'إلكترونيات أصلية مع تركيب احترافي' : 'Genuine electronics with professional installation'}
            </h1>
            <p className="mt-3 max-w-md text-white/80">
              {locale === 'ar'
                ? 'اشترِ، ركّب، وتتبّع طلبك مباشرة — كل ذلك من تطبيق واحد.'
                : 'Buy, install and track your order live — all in one app.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`${base}/search`} className="rounded-full bg-white px-6 py-3 text-sm font-bold text-primary transition hover:bg-white/90">
                {t('catalog.title', locale)}
              </Link>
              <Link href={`${base}/category/air-conditioning`} className="rounded-full border border-white/40 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                {t('product.buyAndInstall', locale)}
              </Link>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/20 shadow-2xl">
              <Image src="https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=900&q=70" alt="" fill className="object-cover" sizes="50vw" />
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { ar: 'ضمان رسمي', en: 'Official warranty' },
          { ar: 'تركيب بفنيين معتمدين', en: 'Certified technicians' },
          { ar: 'دفع KNET وApple Pay', en: 'KNET & Apple Pay' },
          { ar: 'تتبّع مباشر', en: 'Live tracking' },
        ].map((f) => (
          <div key={f.en} className="rounded-2xl border border-border bg-surface p-4 text-sm font-medium shadow-sm">
            {locale === 'ar' ? f.ar : f.en}
          </div>
        ))}
      </section>

      {/* Categories */}
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('nav.categories', locale)}</h2>
          <Link href={`${base}/search`} className="text-sm font-semibold text-primary hover:underline">
            {t('common.seeAll', locale)}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('catalog.featured', locale)}</h2>
          <Link href={`${base}/search`} className="text-sm font-semibold text-primary hover:underline">
            {t('common.seeAll', locale)}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
