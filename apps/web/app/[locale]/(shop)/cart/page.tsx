'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Button, EmptyState, PriceTag } from '@elite/ui/web';
import { useCart } from '@/components/cart-store';
import { useT } from '@/lib/use-t';
import { OrderSummary } from '@/components/order-summary';

export default function CartPage() {
  const { t, locale } = useT();
  const cart = useCart();
  const [promo, setPromo] = useState('');
  const base = `/${locale}`;

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          title={t('cart.empty')}
          description={t('cart.emptyHint')}
          action={
            <Link href={`${base}/search`}>
              <Button>{t('cart.startShopping')}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">{t('cart.title')}</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Lines */}
        <div className="space-y-3 lg:col-span-2">
          {cart.lines.map((l) => {
            const name = locale === 'ar' ? l.nameAr : l.nameEn;
            return (
              <div
                key={`${l.variantId}-${l.withInstallation}`}
                className="flex gap-4 rounded-2xl border border-border bg-surface p-3 shadow-sm"
              >
                <Link href={`${base}/product/${l.productSlug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                  {l.image && <Image src={l.image} alt={name} fill className="object-cover" sizes="96px" />}
                </Link>
                <div className="flex flex-1 flex-col">
                  <Link href={`${base}/product/${l.productSlug}`} className="line-clamp-2 text-sm font-semibold hover:text-primary">
                    {name}
                  </Link>
                  {l.withInstallation && (
                    <span className="mt-1 inline-flex w-fit items-center rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700">
                      {t('cart.withInstallation')}
                    </span>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="inline-flex items-center rounded-full border border-border">
                      <button
                        className="px-3 py-1 text-lg leading-none hover:text-primary"
                        onClick={() => cart.setQty(l.variantId, l.withInstallation, l.qty - 1)}
                        aria-label={t('common.previous')}
                      >
                        −
                      </button>
                      <span className="min-w-8 text-center text-sm font-semibold">{l.qty}</span>
                      <button
                        className="px-3 py-1 text-lg leading-none hover:text-primary"
                        onClick={() => cart.setQty(l.variantId, l.withInstallation, l.qty + 1)}
                        aria-label={t('common.next')}
                      >
                        +
                      </button>
                    </div>
                    <PriceTag price={l.unitPrice * l.qty} locale={locale} inline />
                  </div>
                </div>
                <button
                  className="self-start text-muted hover:text-danger"
                  onClick={() => cart.remove(l.variantId, l.withInstallation)}
                  aria-label={t('cart.removeItem')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            );
          })}

          {/* Promo */}
          <div className="flex gap-2 rounded-2xl border border-border bg-surface p-3 shadow-sm">
            <input
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder={t('cart.promoPlaceholder')}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <Button variant="outline">{t('cart.applyPromo')}</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <OrderSummary totals={cart.totals} sticky>
            <Link href={`${base}/checkout`} className="block">
              <Button size="lg" className="w-full">
                {t('cart.checkout')}
              </Button>
            </Link>
          </OrderSummary>
        </div>
      </div>
    </div>
  );
}
