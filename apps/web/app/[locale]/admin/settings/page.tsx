import { RoleGuard } from '@/components/role-guard';
import { fetchSettings } from '@/lib/admin-settings';
import { SettingsView } from '@/components/admin/settings/settings-view';

// Role-gated, live config — render per request.
export const dynamic = 'force-dynamic';

/** Settings — first-party store/delivery/payment configuration (admin only). */
export default async function SettingsPage() {
  const data = await fetchSettings();
  return (
    <RoleGuard allow={['admin']}>
      <SettingsView data={data} />
    </RoleGuard>
  );
}
