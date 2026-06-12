'use client';

/**
 * Standalone order-detail page body — wraps `OrderDetail` in the gold toast
 * provider and adds a back link. Used by `/admin/orders/[id]`.
 */
import Link from 'next/link';
import type { AdminOrderDetail } from '@/lib/admin-orders';
import { useLocale } from '@/components/providers';
import { OsaToastProvider } from './toast';
import { OrderDetail } from './order-detail';

export function OrderDetailPage({ detail, live }: { detail: AdminOrderDetail; live: boolean }) {
  const { locale } = useLocale();
  return (
    <OsaToastProvider>
      <div className="space-y-[14px]">
        <Link href={`/${locale}/admin/orders`} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-osa-muted hover:text-osa-brand">
          <span aria-hidden>→</span> كل الطلبات
        </Link>
        <OrderDetail detail={detail} />
        {!live && <p className="px-1 text-[11px] text-osa-faint">بيانات تجريبية</p>}
      </div>
    </OsaToastProvider>
  );
}
