import Link from 'next/link';
import { coerceLocale } from '@/lib/i18n';
import { fetchReorderPolicies } from '@/lib/admin-erp';
import { generateReorderPos } from './actions';

export const dynamic = 'force-dynamic';

async function GenerateButton({ locationIds }: { locationIds: string[] }) {
  async function handleGenerate() {
    'use server';
    // Generate for the first distinct location that has needs — in a real UI
    // there would be a location selector; here we fire for each unique location.
    for (const lid of locationIds) {
      await generateReorderPos(lid);
    }
  }
  return (
    <form action={handleGenerate}>
      <button
        type="submit"
        className="rounded-lg bg-osa-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
        disabled={locationIds.length === 0}
      >
        توليد أوامر الشراء
      </button>
    </form>
  );
}

export default async function ReorderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  coerceLocale(raw);

  const data = await fetchReorderPolicies();

  const needsReorderLocs = [
    ...new Set(data.policies.filter((p) => p.needsReorder && p.isActive).map((p) => p.locationId)),
  ];

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-osa-text">سياسات إعادة الطلب</h1>
          <p className="text-sm text-osa-text/60">Reorder Policies</p>
        </div>
        <div className="flex items-center gap-2">
          {!data.live && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
              بيانات تجريبية
            </span>
          )}
          <GenerateButton locationIds={needsReorderLocs} />
        </div>
      </div>

      {/* Draft POs banner */}
      {data.draftPoCount > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-700">
            <span className="font-semibold">{data.draftPoCount}</span> مسودة أوامر شراء تلقائية
            جاهزة للمراجعة
          </p>
          <Link
            href="/ar/admin/purchasing"
            className="text-sm font-medium text-blue-700 underline underline-offset-2"
          >
            عرض المشتريات
          </Link>
        </div>
      )}

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-osa-border bg-osa-surface p-5">
          <p className="text-sm text-osa-text/60">إجمالي السياسات</p>
          <p className="mt-2 text-3xl font-bold text-osa-text">{data.policies.length}</p>
        </div>
        <div className="rounded-xl border border-osa-border bg-osa-surface p-5">
          <p className="text-sm text-osa-text/60">تحتاج إعادة طلب</p>
          <p className="mt-2 text-3xl font-bold text-red-600">
            {data.policies.filter((p) => p.needsReorder && p.isActive).length}
          </p>
        </div>
        <div className="rounded-xl border border-osa-border bg-osa-surface p-5">
          <p className="text-sm text-osa-text/60">نشطة</p>
          <p className="mt-2 text-3xl font-bold text-osa-text">
            {data.policies.filter((p) => p.isActive).length}
          </p>
        </div>
        <div className="rounded-xl border border-osa-border bg-osa-surface p-5">
          <p className="text-sm text-osa-text/60">مواقع متأثرة</p>
          <p className="mt-2 text-3xl font-bold text-osa-text">{needsReorderLocs.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-osa-border bg-osa-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-sm [&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:font-medium [&_th]:text-osa-text/60">
            <thead className="border-b border-osa-border">
              <tr>
                <th>المنتج</th>
                <th>SKU</th>
                <th>الموقع</th>
                <th className="text-end">المخزون</th>
                <th className="text-end">الحد الأدنى</th>
                <th className="text-end">الحد الأقصى</th>
                <th>المورّد</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-osa-border">
              {data.policies.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-osa-text/40">
                    لا توجد سياسات بعد
                  </td>
                </tr>
              )}
              {data.policies.map((policy) => (
                <tr
                  key={`${policy.variantId}:${policy.locationId}`}
                  className={`transition-colors hover:bg-osa-surface/60 ${
                    policy.needsReorder && policy.isActive ? 'bg-red-50/30' : ''
                  }`}
                >
                  <td className="font-medium text-osa-text">{policy.product}</td>
                  <td>
                    {policy.sku ? (
                      <span className="font-mono text-xs text-osa-text/70">{policy.sku}</span>
                    ) : (
                      <span className="text-osa-text/30">—</span>
                    )}
                  </td>
                  <td className="text-osa-text/80">{policy.location}</td>
                  <td className="text-end tabular-nums">
                    <span
                      className={`font-semibold ${
                        policy.needsReorder && policy.isActive
                          ? 'text-red-600'
                          : 'text-osa-text'
                      }`}
                    >
                      {policy.onHand}
                    </span>
                  </td>
                  <td className="text-end tabular-nums text-osa-text/70">{policy.minQty}</td>
                  <td className="text-end tabular-nums text-osa-text/70">{policy.maxQty}</td>
                  <td className="text-osa-text/80">{policy.supplierName ?? '—'}</td>
                  <td>
                    {policy.needsReorder && policy.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        مخزون منخفض
                      </span>
                    ) : policy.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        كافٍ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                        معطّل
                      </span>
                    )}
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
