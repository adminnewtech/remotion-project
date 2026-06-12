import { fetchPosData } from '@/lib/admin-pos';
import { Pos } from '@/components/admin/cashier/pos';

// Role-gated, live ops data — render per request.
export const dynamic = 'force-dynamic';

/** Cashier — in-store point of sale (native order creation). */
export default async function CashierPage() {
  const data = await fetchPosData();
  return <Pos data={data} />;
}
