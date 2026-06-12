import { coerceLocale } from '@/lib/i18n';
import { fetchVanStock } from '@/lib/admin-erp';
import { VanStockClient } from './van-stock-client';

export const dynamic = 'force-dynamic';

export default async function VanStockPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  coerceLocale(raw);

  const data = await fetchVanStock();

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-osa-text">مخزون السيارات</h1>
          <p className="text-sm text-osa-text/60">Van Stock</p>
        </div>
        {!data.live && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
            بيانات تجريبية
          </span>
        )}
      </div>

      <VanStockClient data={data} />
    </div>
  );
}
