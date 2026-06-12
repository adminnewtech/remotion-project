import Image from 'next/image';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import type { Locale } from '@elite/types';
import { coerceLocale, localized } from '@/lib/i18n';
import { PriceTag } from '@elite/ui/web';
import { listWishlist, toggleWishlist } from '@/components/product/wishlist-actions';
import type { WishlistItem } from '@/components/product/wishlist-actions';

/** Inline remove action — called from the form below via server action. */
async function removeFromWishlist(formData: FormData) {
  'use server';
  const productId = formData.get('productId') as string;
  if (productId) {
    await toggleWishlist({ productId });
    revalidatePath('/[locale]/(shop)/account/wishlist', 'page');
  }
}

export default async function WishlistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = coerceLocale(raw);
  const base = `/${locale}`;

  const items = await listWishlist();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {locale === 'ar' ? 'المفضلة' : 'Wishlist'}
        </h1>
        <Link
          href={`${base}/account`}
          className="text-sm font-semibold text-primary hover:underline"
        >
          {locale === 'ar' ? 'طلباتي' : 'My orders'}
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyWishlist locale={locale} base={base} />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <WishlistCard
              key={item.product_id}
              item={item}
              locale={locale}
              base={base}
              removeAction={removeFromWishlist}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function EmptyWishlist({ locale, base }: { locale: string; base: string }) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center">
      <HeartEmptyIcon />
      <div>
        <p className="text-lg font-bold text-foreground">
          {locale === 'ar' ? 'قائمة المفضلة فارغة' : 'Your wishlist is empty'}
        </p>
        <p className="mt-1 text-sm text-muted">
          {locale === 'ar'
            ? 'تصفّح المنتجات وأضف ما يعجبك للحفظ لوقت لاحق.'
            : 'Browse products and save what you love for later.'}
        </p>
      </div>
      <Link
        href={`${base}/`}
        className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700"
      >
        {locale === 'ar' ? 'تصفّح المتجر' : 'Browse the store'}
      </Link>
    </div>
  );
}

function WishlistCard({
  item,
  locale,
  base,
  removeAction,
}: {
  item: WishlistItem;
  locale: Locale;
  base: string;
  removeAction: (formData: FormData) => Promise<void>;
}) {
  const name =
    locale === 'ar' ? item.product.name_ar : (item.product.name_en || item.product.name_ar);
  const pdpHref = `${base}/product/${item.product.slug}`;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:shadow-md">
      {/* Product image */}
      <Link
        href={pdpHref}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100"
        aria-hidden="true"
        tabIndex={-1}
      >
        {item.image ? (
          <Image
            src={item.image}
            alt={name}
            fill
            sizes="80px"
            className="object-contain p-1"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-neutral-300">
            <PlaceholderIcon />
          </span>
        )}
      </Link>

      {/* Product info */}
      <div className="min-w-0 flex-1">
        {item.product.brand && (
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {item.product.brand}
          </p>
        )}
        <Link href={pdpHref} className="transition hover:text-primary">
          <p className="line-clamp-2 text-sm font-semibold text-foreground">{name}</p>
        </Link>
        <div className="mt-1">
          <PriceTag price={item.price} salePrice={item.sale_price} locale={locale} size="sm" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        <Link
          href={pdpHref}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary-700"
        >
          {locale === 'ar' ? 'عرض المنتج' : 'View'}
        </Link>

        <form action={removeAction}>
          <input type="hidden" name="productId" value={item.product_id} />
          <button
            type="submit"
            aria-label={locale === 'ar' ? `إزالة ${name} من المفضلة` : `Remove ${name} from wishlist`}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted transition hover:border-danger-300 hover:text-danger-600"
          >
            {locale === 'ar' ? 'إزالة' : 'Remove'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Icons ───────────────────────────────────────────────────

function HeartEmptyIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-neutral-300"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function PlaceholderIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-4.35-4.35a2 2 0 0 0-2.83 0L3 21" />
    </svg>
  );
}
