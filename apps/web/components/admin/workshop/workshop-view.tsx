'use client';

import type { TaskStatus } from '@elite/types';
import { StatusPill, ProgressBar } from '@elite/ui/web';
import type { StatusTone } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { PageHeader, KpiCard } from '@/components/admin/ui';
import type { WorkshopData } from '@/lib/admin-workshop';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';

function tone(s: TaskStatus): StatusTone {
  switch (s) {
    case 'completed': return 'done';
    case 'in_progress': case 'arrived': case 'en_route': return 'prep';
    case 'assigned': case 'accepted': return 'new';
    default: return 'neutral';
  }
}

/** Workshop — installation job execution: checklist progress, photos, status. */
export function WorkshopView({ data }: { data: WorkshopData }) {
  const { t, locale } = useT();
  const ar = locale === 'ar';

  return (
    <>
      <PageHeader title={ar ? 'الورشة' : 'Workshop'} subtitle={ar ? 'تنفيذ التركيبات والصيانة' : 'Installation & repair execution'} />

      <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-4">
        <KpiCard label={ar ? 'مجدول اليوم' : 'Scheduled today'} value={String(data.scheduledToday)} />
        <KpiCard label={ar ? 'قيد التنفيذ' : 'In progress'} value={String(data.inProgress)} />
        <KpiCard label={ar ? 'مكتمل' : 'Completed'} value={String(data.completedWeek)} />
        <KpiCard label={ar ? 'ضمان مفتوح' : 'Open warranty'} value={String(data.openWarranty)} />
      </div>

      <div className={`${CARD} mt-[14px] overflow-hidden`}>
        <h2 className="border-b border-osa-border p-3 text-[14.5px] font-bold text-osa-ink">{ar ? 'مهام التركيب' : 'Installation jobs'}</h2>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {[ar ? 'الطلب' : 'Order', ar ? 'الفني' : 'Technician', ar ? 'المنطقة' : 'Area', ar ? 'الموعد' : 'Scheduled', ar ? 'القائمة' : 'Checklist', ar ? 'الصور' : 'Photos', ar ? 'الحالة' : 'Status'].map((h, i) => (
                <th key={i} className="border-b border-osa-border px-[16px] pb-[11px] pt-[14px] text-start text-[11.5px] font-medium text-osa-faint">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.jobs.map((j) => (
              <tr key={j.id} className="transition-colors hover:bg-osa-surface-2">
                <td className="border-b border-osa-border px-[16px] py-[11px]"><span className="num text-osa-ink">{j.orderNumber}</span></td>
                <td className="border-b border-osa-border px-[16px] py-[11px] text-osa-ink">{j.tech}</td>
                <td className="border-b border-osa-border px-[16px] py-[11px] text-osa-muted">{j.area ?? '—'}</td>
                <td className="border-b border-osa-border px-[16px] py-[11px]"><span className="num text-[12px] text-osa-muted">{j.scheduledFor ?? '—'}</span></td>
                <td className="border-b border-osa-border px-[16px] py-[11px]">
                  <div className="flex items-center gap-2">
                    <div className="w-20"><ProgressBar value={j.checklistTotal ? (j.checklistDone / j.checklistTotal) * 100 : 0} height={6} /></div>
                    <span className="num text-[11.5px] text-osa-faint">{j.checklistDone}/{j.checklistTotal}</span>
                  </div>
                </td>
                <td className="border-b border-osa-border px-[16px] py-[11px]"><span className="num text-osa-muted">{j.photos}</span></td>
                <td className="border-b border-osa-border px-[16px] py-[11px]"><StatusPill tone={tone(j.status)}>{t(`taskStatus.${j.status}`)}</StatusPill></td>
              </tr>
            ))}
            {data.jobs.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-[12.5px] text-osa-faint">{t('common.none')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
