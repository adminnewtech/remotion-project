import { fetchInventorySuite } from '@/lib/admin-inventory';
import { InventorySuiteView } from '@/components/admin/inventory/inventory-suite';

// Role-gated, live ops data — render per request.
export const dynamic = 'force-dynamic';

/** Inventory suite — multi-location matrix, immutable ledger, locations. */
export default async function InventoryPage() {
  const data = await fetchInventorySuite();
  return <InventorySuiteView data={data} />;
}
