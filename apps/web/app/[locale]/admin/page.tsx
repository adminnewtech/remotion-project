import { fetchAdminDashboard } from '@/lib/data';
import { DashboardView } from '@/components/admin/dashboard-view';

/** Admin dashboard — live KPIs + recent orders, computed server-side. */
export default async function AdminDashboard() {
  const data = await fetchAdminDashboard();
  return <DashboardView data={data} />;
}
