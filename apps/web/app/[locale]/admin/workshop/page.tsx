import { fetchWorkshop } from '@/lib/admin-workshop';
import { WorkshopView } from '@/components/admin/workshop/workshop-view';

// Role-gated, live ops data — render per request.
export const dynamic = 'force-dynamic';

/** Workshop — installation job execution (checklist, photos, completion). */
export default async function WorkshopPage() {
  const data = await fetchWorkshop();
  return <WorkshopView data={data} />;
}
