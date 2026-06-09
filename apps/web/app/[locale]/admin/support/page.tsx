import { coerceLocale, t } from '@/lib/i18n';
import { fetchTickets } from '@/lib/data';
import { AdminSupportQueue } from '@/components/admin/support-queue';

export default async function AdminSupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = coerceLocale(raw);
  const tickets = await fetchTickets();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t('nav.support', locale)}</h1>
      <AdminSupportQueue tickets={tickets} />
    </div>
  );
}
