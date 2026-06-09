'use client';

import type { ReactNode } from 'react';
import { PriceTag } from '@elite/ui/web';
import { FREE_DELIVERY_THRESHOLD_KWD } from '@elite/types';
import { useT } from '@/lib/use-t';
import { fmtKWD } from '@/lib/format';

interface Totals {
  subtotal: number;
  deliveryFee: number;
  installationFee: number;
  total: number;
  discount?: number;
}

/** Reusable order-summary card (cart + checkout). */
export function OrderSummary({
  totals,
  children,
  sticky = false,
}: {
  totals: Totals;
  children?: ReactNode;
  sticky?: boolean;
}) {
  const { t, locale } = useT();
  const remaining = FREE_DELIVERY_THRESHOLD_KWD - totals.subtotal;

  const Row = ({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) => (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={accent ? 'font-semibold text-success' : 'font-medium'}>{value}</span>
    </div>
  );

  return (
    <div className={`rounded-2xl border border-border bg-surface p-5 shadow-sm ${sticky ? 'lg:sticky lg:top-24' : ''}`}>
      <h2 className="mb-4 text-lg font-bold">{t('checkout.orderSummary')}</h2>

      {remaining > 0 && totals.subtotal > 0 && (
        <p className="mb-4 rounded-xl bg-accent-50 px-3 py-2 text-xs font-medium text-accent-700">
          {t('cart.freeDeliveryHint', { amount: fmtKWD(remaining, locale) })}
        </p>
      )}

      <div className="space-y-2">
        <Row label={t('cart.subtotal')} value={<PriceTag price={totals.subtotal} locale={locale} inline />} />
        <Row
          label={t('cart.deliveryFee')}
          value={totals.deliveryFee === 0 ? t('cart.freeDelivery') : <PriceTag price={totals.deliveryFee} locale={locale} inline />}
          accent={totals.deliveryFee === 0 && totals.subtotal > 0}
        />
        {totals.installationFee > 0 && (
          <Row label={t('cart.installationFee')} value={<PriceTag price={totals.installationFee} locale={locale} inline />} />
        )}
        {totals.discount ? (
          <Row label={t('cart.discount')} value={`− ${fmtKWD(totals.discount, locale)}`} accent />
        ) : null}
      </div>

      <div className="my-4 border-t border-border" />
      <div className="flex items-center justify-between">
        <span className="text-base font-bold">{t('cart.total')}</span>
        <PriceTag price={totals.total} locale={locale} size="lg" inline />
      </div>

      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
