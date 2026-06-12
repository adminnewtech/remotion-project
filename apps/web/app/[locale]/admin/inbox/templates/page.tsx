import { coerceLocale } from '@/lib/i18n';
import { getServerClient } from '@/lib/supabase/server';
import { TemplatesManager, type Template } from '@/components/admin/crm/templates-manager';

export const dynamic = 'force-dynamic';

async function fetchTemplates() {
  const sb = await getServerClient();
  if (!sb) return sampleTemplates;
  const { data } = await sb
    .from('wa_templates')
    .select('name, language, category, body, params, is_active')
    .order('name');
  return data ?? sampleTemplates;
}

const sampleTemplates = [
  {
    name: 'order_paid',
    language: 'ar',
    category: 'utility',
    body: 'أهلاً {{1}}، تم تأكيد طلبك رقم {{2}} بنجاح. سيصلك قريباً.',
    params: 2,
    is_active: true,
  },
  {
    name: 'order_shipped',
    language: 'ar',
    category: 'utility',
    body: 'طلبك رقم {{1}} في الطريق إليك. المندوب سيتصل بك قريباً.',
    params: 1,
    is_active: true,
  },
  {
    name: 'welcome_vip',
    language: 'ar',
    category: 'marketing',
    body: 'مبروك {{1}}! انضممت لبرنامج نيوتك VIP. استمتع بمزايا حصرية.',
    params: 1,
    is_active: true,
  },
];

export default async function AdminInboxTemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = coerceLocale(raw);
  const templates = await fetchTemplates();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-osa-ink">
          {locale === 'ar' ? 'قوالب واتساب' : 'WhatsApp Templates'}
        </h1>
        <p className="mt-1 text-sm text-osa-muted">
          {locale === 'ar'
            ? 'إدارة قوالب الرسائل المعتمدة — خدمة وتسويق ومصادقة.'
            : 'Manage approved message templates — utility, marketing and authentication.'}
        </p>
      </div>
      <TemplatesManager templates={templates as Template[]} />
    </div>
  );
}
