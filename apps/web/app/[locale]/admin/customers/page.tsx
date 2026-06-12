import { fetchCustomers } from '@/lib/admin-customers';
import { CustomersView } from '@/components/admin/customers/customers-view';

// Role-gated, live ops data — render per request.
export const dynamic = 'force-dynamic';

/** Customers (CRM-lite) — live directory with order count + lifetime spend. */
export default async function CustomersPage() {
  const data = await fetchCustomers();
  return <CustomersView data={data} />;
}
