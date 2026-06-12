import { coerceLocale } from '@/lib/i18n';
import { fetchCycleCounts } from '@/lib/admin-erp';
import { postCycleCount } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  counting: 'جاري العد',
  review: 'مراجعة',
  posted: 'مرحّل',
  cancelled: 'ملغي',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-neutral-100 text-neutral-600',
  counting: 'bg-blue-50 text-blue-700',
  review: 'bg-orange-50 text-orange-700',
  posted: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-600',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-neutral-100 text-neutral-600'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

async function PostCountButton({ countId }: { countId: string }) {
  async function handlePost() {
    'use server';
    await postCycleCount(countId);
  }
  return (
    <form action={handlePost}>
      <button
        type="submit"
        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
      >
        ترحيل
      </button>
    </form>
  );
}

export default async function CycleCountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  coerceLocale(raw);

  const data = await fetchCycleCounts();

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const totalCounts = data.counts.length;
  const inReview = data.counts.filter((c) => c.status === 'review');
  const postedThisMonth = data.counts.filter(
    (c) => c.status === 'posted' && c.postedAt && c.postedAt >= thisMonthStart,
  ).length;

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-osa-text">الجرد الدوري</h1>
          <p className="text-sm text-osa-text/60">Cycle Counts</p>
        </div>
        <div className="flex items-center gap-2">
          {!data.live && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
              بيانات تجريبية
            </span>
          )}
          <a
            href="counts/new"
            className="rounded-lg bg-osa-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            + إنشاء جرد جديد
          </a>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-osa-border bg-osa-surface p-5">
          <p className="text-sm text-osa-text/60">إجمالي الجردات</p>
          <p className="mt-2 text-3xl font-bold text-osa-text">{totalCounts}</p>
        </div>
        <div className="rounded-xl border border-osa-border bg-osa-surface p-5">
          <p className="text-sm text-osa-text/60">في المراجعة</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-osa-text">{inReview.length}</p>
            {inReview.length > 0 && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                {inReview.reduce((s, c) => s + c.variance, 0)} فرق
              </span>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-osa-border bg-osa-surface p-5">
          <p className="text-sm text-osa-text/60">مرحّل هذا الشهر</p>
          <p className="mt-2 text-3xl font-bold text-osa-text">{postedThisMonth}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-osa-border bg-osa-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-sm [&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:font-medium [&_th]:text-osa-text/60">
            <thead className="border-b border-osa-border">
              <tr>
                <th>رقم الجرد</th>
                <th>الموقع</th>
                <th>الحالة</th>
                <th className="text-end">عدد الأصناف</th>
                <th className="text-end">الفروقات</th>
                <th>تاريخ الإنشاء</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-osa-border">
              {data.counts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-osa-text/40">
                    لا توجد جردات بعد
                  </td>
                </tr>
              )}
              {data.counts.map((count) => (
                <tr key={count.id} className="transition-colors hover:bg-osa-surface/60">
                  <td>
                    <span className="font-mono text-xs font-semibold text-osa-text">
                      {count.count_number}
                    </span>
                  </td>
                  <td className="text-osa-text">{count.location}</td>
                  <td>
                    <StatusBadge status={count.status} />
                  </td>
                  <td className="text-end tabular-nums text-osa-text">{count.itemCount}</td>
                  <td className="text-end">
                    {count.variance > 0 ? (
                      <span className="font-semibold text-orange-600">{count.variance}</span>
                    ) : (
                      <span className="text-osa-text/40">—</span>
                    )}
                  </td>
                  <td className="text-xs text-osa-text/60">
                    {new Date(count.createdAt).toLocaleDateString('ar-KW', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <a
                        href={`counts/${count.id}`}
                        className="rounded-lg border border-osa-border px-3 py-1.5 text-xs font-medium text-osa-text transition-colors hover:bg-osa-surface/80"
                      >
                        عرض
                      </a>
                      {count.status === 'review' && <PostCountButton countId={count.id} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
