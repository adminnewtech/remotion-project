import { coerceLocale } from '@/lib/i18n';
import { fetchReconciliation } from '@/lib/admin-accounting-ledger';
import { ReconciliationView } from '@/components/admin/finance/reconciliation-view';

// Role-gated, live data — render per request.
export const dynamic = 'force-dynamic';

/** OSALPHA gold KNET reconciliation — upload, match, post. */
export default async function ReconciliationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  coerceLocale(raw);

  const data = await fetchReconciliation();
  return <ReconciliationView data={data} />;
}
