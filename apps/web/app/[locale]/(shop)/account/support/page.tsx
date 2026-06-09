import { coerceLocale, t } from '@/lib/i18n';
import { fetchTickets } from '@/lib/data';
import { SupportPanel } from '@/components/support-panel';

export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = coerceLocale(raw);
  const tickets = await fetchTickets();
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">{t('support.title', locale)}</h1>
      <SupportPanel tickets={tickets} />
    </div>
  );
}
