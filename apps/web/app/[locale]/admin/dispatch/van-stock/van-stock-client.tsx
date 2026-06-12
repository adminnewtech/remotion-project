'use client';

import { useState, useTransition } from 'react';
import type { VanStockData, VanRow } from '@/lib/admin-erp';
import { transferToVan } from './actions';

// ── Load modal ───────────────────────────────────────────────────────────────

function LoadModal({
  van,
  warehouses,
  onClose,
}: {
  van: VanRow;
  warehouses: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [variantId, setVariantId] = useState('');
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!variantId.trim() || !warehouseId) return;
    startTransition(async () => {
      const res = await transferToVan({
        variantId: variantId.trim(),
        fromLocationId: warehouseId,
        toLocationId: van.id,
        qty,
        ref: `van-load-${van.id}`,
      });
      if (res.ok) {
        setStatus('ok');
      } else {
        setStatus('err');
        setErrMsg(res.error ?? 'خطأ غير معروف');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-800">
            تحميل مواد — {van.name}
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 transition-colors hover:text-neutral-700"
          >
            ✕
          </button>
        </div>

        {status === 'ok' ? (
          <div className="py-6 text-center">
            <div className="mb-3 text-4xl">✓</div>
            <p className="font-semibold text-green-700">تم التحميل بنجاح</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-lg bg-osa-primary px-6 py-2 text-sm font-medium text-white"
            >
              إغلاق
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                المستودع المصدر
              </label>
              {warehouses.length === 0 ? (
                <p className="text-sm text-neutral-500">لا توجد مستودعات متاحة</p>
              ) : (
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-osa-primary/30"
                  required
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                معرّف المنتج (Variant ID)
              </label>
              <input
                type="text"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                placeholder="UUID المنتج..."
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-osa-primary/30"
                required
              />
              <p className="mt-1 text-xs text-neutral-400">
                أدخل UUID المنتج المراد تحميله في السيارة
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">الكمية</label>
              <input
                type="number"
                min={1}
                max={9999}
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-osa-primary/30"
                required
              />
            </div>

            {status === 'err' && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errMsg}</div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isPending || warehouses.length === 0}
                className="rounded-lg bg-osa-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? 'جاري التحميل...' : 'تحميل'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Van card ─────────────────────────────────────────────────────────────────

function VanCard({
  van,
  warehouses,
}: {
  van: VanRow;
  warehouses: { id: string; name: string }[];
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-osa-border bg-osa-surface">
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-osa-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-osa-primary/10 text-lg">
              🚐
            </div>
            <div>
              <p className="font-semibold text-osa-text">{van.name}</p>
              {van.ownerName && (
                <p className="text-xs text-osa-text/60">{van.ownerName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-end">
              <p className="text-xs text-osa-text/60">إجمالي المواد</p>
              <p className="text-xl font-bold text-osa-text">{van.totalItems}</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-osa-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              تحميل مواد
            </button>
          </div>
        </div>

        {/* Items table */}
        {van.items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-osa-text/40">لا توجد مواد في هذه السيارة</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm [&_td]:px-4 [&_td]:py-2.5 [&_th]:px-4 [&_th]:py-2 [&_th]:text-start [&_th]:font-medium [&_th]:text-osa-text/60">
              <thead className="border-b border-osa-border">
                <tr>
                  <th>المنتج</th>
                  <th>SKU</th>
                  <th className="text-end">الكمية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-osa-border">
                {van.items.map((item, i) => (
                  <tr key={`${item.sku}-${i}`} className="hover:bg-osa-surface/60">
                    <td className="text-osa-text">{item.product}</td>
                    <td>
                      {item.sku ? (
                        <span className="font-mono text-xs text-osa-text/70">{item.sku}</span>
                      ) : (
                        <span className="text-osa-text/30">—</span>
                      )}
                    </td>
                    <td className="text-end tabular-nums font-semibold text-osa-text">
                      {item.onHand}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <LoadModal
          van={van}
          warehouses={warehouses}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ── Main client component ────────────────────────────────────────────────────

export function VanStockClient({ data }: { data: VanStockData }) {
  if (data.vans.length === 0) {
    return (
      <div className="rounded-xl border border-osa-border bg-osa-surface p-12 text-center">
        <p className="text-osa-text/40">لا توجد سيارات نشطة</p>
        <p className="mt-1 text-xs text-osa-text/30">
          أضف موقعاً من نوع &apos;van&apos; في إعدادات المواقع
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-osa-border bg-osa-surface p-5">
          <p className="text-sm text-osa-text/60">عدد السيارات</p>
          <p className="mt-2 text-3xl font-bold text-osa-text">{data.vans.length}</p>
        </div>
        <div className="rounded-xl border border-osa-border bg-osa-surface p-5">
          <p className="text-sm text-osa-text/60">إجمالي المواد</p>
          <p className="mt-2 text-3xl font-bold text-osa-text">
            {data.vans.reduce((s, v) => s + v.totalItems, 0)}
          </p>
        </div>
        <div className="rounded-xl border border-osa-border bg-osa-surface p-5">
          <p className="text-sm text-osa-text/60">سيارات بمخزون</p>
          <p className="mt-2 text-3xl font-bold text-osa-text">
            {data.vans.filter((v) => v.totalItems > 0).length}
          </p>
        </div>
      </div>

      {/* Van cards */}
      {data.vans.map((van) => (
        <VanCard key={van.id} van={van} warehouses={data.warehouses} />
      ))}
    </div>
  );
}
