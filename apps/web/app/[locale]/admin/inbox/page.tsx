import { coerceLocale } from '@/lib/i18n';
import { fetchInbox } from '@/lib/admin-inbox';
import { InboxView } from '@/components/admin/crm/inbox-view';

export const dynamic = 'force-dynamic';

export default async function AdminInboxPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = coerceLocale(raw);

  const data = await fetchInbox();

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-osa-ink">
          {locale === 'ar' ? 'صندوق واتساب' : 'WhatsApp Inbox'}
        </h1>
        <p className="mt-1 text-sm text-osa-muted">
          {locale === 'ar'
            ? 'رسائل واتساب الواردة والصادرة — إرسال قوالب وردود مباشرة.'
            : 'Inbound and outbound WhatsApp messages — send templates and direct replies.'}
        </p>
      </div>
      <InboxView data={data} />
    </div>
  );
}
