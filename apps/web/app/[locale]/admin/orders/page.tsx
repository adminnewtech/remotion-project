import { coerceLocale } from '@/lib/i18n';
import { fetchAdminOrders, type AdminOrderDetail } from '@/lib/admin-orders';
import { deriveDetailFromRow } from '@/lib/admin-orders-sample';
import { OrdersList } from '@/components/admin/orders/orders-list';

// Role-gated, live data — render per request.
export const dynamic = 'force-dynamic';

/** OSALPHA gold orders list — KPIs, gold DataTable, filters, bulk actions. */
export default async function AdminOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  coerceLocale(raw);

  const data = await fetchAdminOrders();
  // Detail records for the list drawer, derived from the rows (no N+1 fetch).
  const details: Record<string, AdminOrderDetail> = {};
  for (const row of data.rows) details[row.id] = deriveDetailFromRow(row);

  return <OrdersList data={data} details={details} />;
}
