import { coerceLocale } from '@/lib/i18n';
import { fetchCodData } from '@/lib/admin-accounting-ledger';
import { CodView } from '@/components/admin/finance/cod-view';

// Role-gated, live data — render per request.
export const dynamic = 'force-dynamic';

/** OSALPHA gold COD remittance tracker — تحصيلات الدفع عند الاستلام. */
export default async function CodPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  coerceLocale(raw);

  const data = await fetchCodData();
  return <CodView data={data} />;
}
