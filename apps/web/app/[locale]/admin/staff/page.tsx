import { RoleGuard } from '@/components/role-guard';
import { fetchStaff } from '@/lib/admin-staff';
import { StaffTable } from '@/components/admin/staff/staff-table';

// Role-gated, live ops data — render per request.
export const dynamic = 'force-dynamic';

/** Staff management — live team + native role assignment (admin only). */
export default async function StaffPage() {
  const data = await fetchStaff();
  return (
    <RoleGuard allow={['admin']}>
      <StaffTable data={data} />
    </RoleGuard>
  );
}
