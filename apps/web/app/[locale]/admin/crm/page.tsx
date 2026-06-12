import { coerceLocale } from '@/lib/i18n';
import { fetchPipeline } from '@/lib/admin-crm-pipeline';
import { PipelineBoard } from '@/components/admin/crm/pipeline-board';

export const dynamic = 'force-dynamic';

export default async function AdminCrmPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = coerceLocale(raw);

  const data = await fetchPipeline();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-osa-ink">
          {locale === 'ar' ? 'خط المبيعات' : 'Sales Pipeline'}
        </h1>
        <p className="mt-1 text-sm text-osa-muted">
          {locale === 'ar'
            ? `${data.pipelineName} — إدارة الصفقات والمراحل`
            : `${data.pipelineName} — manage deals and stages`}
        </p>
      </div>
      <PipelineBoard data={data} />
    </div>
  );
}
