'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@elite/ui/web';
import { useT } from '@/lib/use-t';

export default function ConfirmationPage() {
  const { t, locale } = useT();
  const sp = useSearchParams();
  const orderNumber = sp.get('order') ?? 'NT-000000';
  const pickupCode = sp.get('pickup');
  const base = `/${locale}`;

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-success text-white">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold">{t('checkout.orderPlaced')}</h1>
      <p className="mt-2 text-muted">{t('checkout.orderPlacedHint', { orderNumber })}</p>

      {pickupCode && (
        <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{t('checkout.pickupCodeLabel')}</p>
          <p className="mt-1 text-3xl font-bold tracking-[0.3em] text-primary">{pickupCode}</p>
          <p className="mt-2 text-xs text-muted">{t('checkout.pickupCodeHint')}</p>
        </div>
      )}

      <div className="mt-8 flex justify-center gap-3">
        <Link href={`${base}/account`}>
          <Button>{t('orders.title')}</Button>
        </Link>
        <Link href={base}>
          <Button variant="outline">{t('nav.home')}</Button>
        </Link>
      </div>
    </div>
  );
}
