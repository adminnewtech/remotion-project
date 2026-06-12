import { RoleGuard } from '@/components/role-guard';
import { fetchMarketing } from '@/lib/admin-marketing';
import { MarketingView } from '@/components/admin/marketing/marketing-view';

// Role-gated, live ops data — render per request.
export const dynamic = 'force-dynamic';

/** Marketing — native campaigns + our own catalog feed (admin only). */
export default async function MarketingPage() {
  const data = await fetchMarketing();
  return (
    <RoleGuard allow={['admin']}>
      <MarketingView data={data} />
    </RoleGuard>
  );
}
