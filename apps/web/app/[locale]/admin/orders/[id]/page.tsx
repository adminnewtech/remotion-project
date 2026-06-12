import { notFound } from 'next/navigation';
import { coerceLocale } from '@/lib/i18n';
import { fetchAdminOrder } from '@/lib/admin-orders';
import { OrderDetailPage } from '@/components/admin/orders/order-detail-page';

// Role-gated, live data — render per request.
export const dynamic = 'force-dynamic';

/** OSALPHA gold order detail / edit — full record, status changer, timeline. */
export default async function AdminOrderDetailRoute({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  coerceLocale(raw);

  const res = await fetchAdminOrder(id);
  if (!res) notFound();

  return <OrderDetailPage detail={res.detail} live={res.live} />;
}
