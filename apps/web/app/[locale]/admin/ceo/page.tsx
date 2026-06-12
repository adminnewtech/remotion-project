import { fetchCeoData } from './data';
import { CeoDashboard } from '@/components/admin/ceo/ceo-dashboard';

// Executive view is fully data/auth driven — never statically rendered.
export const dynamic = 'force-dynamic';

/** CEO dashboard — premium executive overview + AI brief + ops copilot. */
export default async function CeoPage() {
  const data = await fetchCeoData();
  return <CeoDashboard data={data} />;
}
