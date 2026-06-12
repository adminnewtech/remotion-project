import { RoleGuard } from '@/components/role-guard';
import { fetchFinance } from '@/lib/admin-finance';
import { FinanceView } from '@/components/admin/finance/finance-view';

// Role-gated, live ops data — render per request.
export const dynamic = 'force-dynamic';

/** Finance — native figures from our own orders + expenses (admin only). */
export default async function FinancePage() {
  const data = await fetchFinance();
  return (
    <RoleGuard allow={['admin']}>
      <FinanceView data={data} />
    </RoleGuard>
  );
}
