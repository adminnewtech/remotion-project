import { fetchOverview } from '@/lib/data';
import { Overview } from '@/components/admin/overview';

/** OSALPHA admin overview — gold dashboard wired to live @elite/core analytics. */
export default async function AdminOverviewPage() {
  const data = await fetchOverview();
  return <Overview data={data} />;
}
