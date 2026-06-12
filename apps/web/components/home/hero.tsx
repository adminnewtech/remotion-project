import Link from 'next/link';
import Image from 'next/image';
import type { Locale } from '@elite/types';
import { t } from '@/lib/i18n';
import { SearchBar } from '@/components/search-bar';

/**
 * Premium storefront hero. Brand indigo→cyan gradient, headline about
 * electronics + professional installation + 24h delivery, a search CTA, and
 * trust chips. The decorative product image is `priority`-loaded for LCP.
 */
export function HomeHero({
  locale,
  image,
}: {
  locale: Locale;
  image: string | null;
}) {
  const ar = locale === 'ar';
  const base = `/${locale}`;

  const chips = ar
    ? ['ضمان سنة', 'تركيب احترافي', 'توصيل خلال ٢٤ ساعة', 'دفع KNET']
    : ['1-year warranty', 'Pro installation', '24h delivery', 'KNET pay'];

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-800 via-primary to-primary-600 text-white shadow-xl">
      {/* Decorative glow */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 85% 15%, rgba(6,182,212,0.55), transparent 42%), radial-gradient(circle at 5% 95%, rgba(129,140,248,0.5), transparent 38%)',
        }}
        aria-hidden
      />
      <div className="relative grid items-center gap-8 p-7 sm:p-10 md:grid-cols-2 md:p-14">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent-300" />
            {ar ? 'الأكثر مبيعاً في الكويت' : 'Kuwait’s trusted electronics store'}
          </span>
          <h1 className="mt-5 text-3xl font-black leading-[1.15] sm:text-4xl md:text-5xl">
            {ar ? (
              <>
                إلكترونيات أصلية
                <br />
                <span className="bg-gradient-to-r from-accent-200 to-accent-400 bg-clip-text text-transparent">
                  مع تركيب احترافي
                </span>
              </>
            ) : (
              <>
                Genuine electronics
                <br />
                <span className="bg-gradient-to-r from-accent-200 to-accent-400 bg-clip-text text-transparent">
                  with pro installation
                </span>
              </>
            )}
          </h1>
          <p className="mt-4 max-w-md text-base text-white/85">
            {ar
              ? 'اشترِ، ركّب، وتتبّع طلبك مباشرة — مع توصيل خلال ٢٤ ساعة في كل الكويت.'
              : 'Buy, install and track your order live — with 24-hour delivery across Kuwait.'}
          </p>

          <div className="mt-6 max-w-md">
            <SearchBar />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`${base}/search`}
              className="rounded-full bg-white px-6 py-3 text-sm font-bold text-primary shadow-lg transition hover:bg-white/90 active:scale-95"
            >
              {t('catalog.title', locale)}
            </Link>
            <Link
              href={`${base}/search?sort=sale`}
              className="rounded-full border border-white/40 bg-white/5 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15 active:scale-95"
            >
              {t('catalog.onSale', locale)}
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {chips.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90">
                <CheckIcon />
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="hidden md:block">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/20 bg-white/5 shadow-2xl">
            {image && (
              <Image
                src={image}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width:768px) 0px, 45vw"
                priority
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-400/30">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-accent-200">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}
