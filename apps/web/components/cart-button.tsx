'use client';

import Link from 'next/link';
import { useCart } from '@/components/cart-store';
import { useT } from '@/lib/use-t';

/** Header cart icon with a live item-count badge. */
export function CartButton() {
  const { count } = useCart();
  const { t, locale } = useT();

  return (
    <Link
      href={`/${locale}/cart`}
      aria-label={t('nav.cart')}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:border-primary hover:text-primary"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 0 0 5.6 19H17" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="21" r="1" />
        <circle cx="18" cy="21" r="1" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1 -end-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-accent-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}
