import { fetchPurchasing } from '@/lib/admin-purchasing';
import { PurchasingView } from '@/components/admin/purchasing/purchasing-view';

// Role-gated, live ops data — render per request.
export const dynamic = 'force-dynamic';

/** Purchasing — suppliers, POs, serialized receiving into the stock ledger. */
export default async function PurchasingPage() {
  const data = await fetchPurchasing();
  return <PurchasingView data={data} />;
}
