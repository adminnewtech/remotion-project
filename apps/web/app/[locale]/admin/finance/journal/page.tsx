import { coerceLocale } from '@/lib/i18n';
import { fetchLedger } from '@/lib/admin-accounting-ledger';
import { JournalView } from '@/components/admin/finance/journal-view';

// Role-gated, live data — render per request.
export const dynamic = 'force-dynamic';

/** OSALPHA gold journal ledger — trial balance, recent entries, replay posting. */
export default async function JournalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  coerceLocale(raw);

  const data = await fetchLedger(50);
  return <JournalView data={data} />;
}
