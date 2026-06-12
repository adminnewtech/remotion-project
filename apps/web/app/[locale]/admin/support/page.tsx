import { coerceLocale, t } from '@/lib/i18n';
import { fetchSupportInbox } from '@/lib/data';
import { AdminSupportQueue } from '@/components/admin/support-queue';

export default async function AdminSupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = coerceLocale(raw);
  const { tickets, messages } = await fetchSupportInbox();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('nav.support', locale)}</h1>
        <p className="mt-1 text-sm text-muted">
          {locale === 'ar'
            ? 'صندوق وارد موحّد — كل المحادثات (التطبيق، واتساب، إنستغرام، البريد) في مكان واحد.'
            : 'Unified inbox — every conversation (in-app, WhatsApp, Instagram, email) in one place.'}
        </p>
      </div>
      <AdminSupportQueue tickets={tickets} initialMessages={messages} />
    </div>
  );
}
