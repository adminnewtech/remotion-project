import { coerceLocale } from '@/lib/i18n';
import { fetchOrders } from '@/lib/data';
import { AdminOrdersTable } from '@/components/admin/orders-table';

export default async function AdminOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  coerceLocale(raw);
  const orders = await fetchOrders();
  return <AdminOrdersTable orders={orders} />;
}
