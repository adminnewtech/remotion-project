'use client';

/**
 * OSALPHA inventory view — per-variant on-hand / reserved / available with
 * low-stock highlights and inline quick-adjust (Enter saves, optimistic + toast).
 * Wired to the catalog data seam + `adjustInventory` server action.
 */
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useT } from '@/lib/use-t';
import type { InventoryRow } from '@/lib/admin-catalog';
import { adjustInventory } from './actions';
import { int, GhostButton, useToast } from './shared';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';

export function InventoryView({ data }: { data: { live: boolean; rows: InventoryRow[] } }) {
  const { locale } = useT();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  const [onHand, setOnHand] = useState<Record<string, number>>(
    Object.fromEntries(data.rows.map((r) => [r.variantId, r.onHand])),
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [onlyLow, setOnlyLow] = useState(false);
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.rows
      .map((r) => {
        const oh = onHand[r.variantId] ?? r.onHand;
        return { ...r, onHand: oh, available: Math.max(0, oh - r.reserved) };
      })
      .filter((r) => {
        if (onlyLow && r.available > r.lowThreshold) return false;
        if (term) {
          const hay = `${r.productNameAr} ${r.productNameEn} ${r.sku ?? ''}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      });
  }, [data.rows, onHand, onlyLow, q]);

  const lowCount = useMemo(
    () => data.rows.filter((r) => (onHand[r.variantId] ?? r.onHand) - r.reserved <= r.lowThreshold).length,
    [data.rows, onHand],
  );

  function commit(variantId: string, prev: number) {
    const raw = draft[variantId];
    const value = raw === undefined ? prev : Math.max(0, Math.round(Number(raw)));
    if (Number.isNaN(value) || value === prev) {
      setDraft((d) => { const n = { ...d }; delete n[variantId]; return n; });
      return;
    }
    setOnHand((o) => ({ ...o, [variantId]: value }));
    setDraft((d) => { const n = { ...d }; delete n[variantId]; return n; });
    startTransition(async () => {
      const res = await adjustInventory(variantId, value);
      if (!res.ok) {
        setOnHand((o) => ({ ...o, [variantId]: prev }));
        toast('تعذّر تحديث المخزون', { tone: 'error' });
      } else {
        toast('تم تحديث المخزون', { tone: 'success', undo: () => {
          setOnHand((o) => ({ ...o, [variantId]: prev }));
          startTransition(async () => { await adjustInventory(variantId, prev); });
        } });
      }
    });
  }

  function step(variantId: string, prev: number, delta: number) {
    const value = Math.max(0, prev + delta);
    setOnHand((o) => ({ ...o, [variantId]: value }));
    startTransition(async () => {
      const res = await adjustInventory(variantId, value);
      if (!res.ok) {
        setOnHand((o) => ({ ...o, [variantId]: prev }));
        toast('تعذّر تحديث المخزون', { tone: 'error' });
      }
    });
  }

  return (
    <div className="space-y-[14px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-osa-ink">المخزون</h1>
          <p className="text-[13px] text-osa-muted">المتوفر والمحجوز لكل متغيّر · تعديل سريع</p>
        </div>
        <Link
          href={`/${locale}/admin/catalog`}
          className="inline-flex items-center gap-2 rounded-full border border-osa-border-strong bg-osa-surface px-4 py-[9px] text-[13px] font-semibold text-osa-muted transition-colors hover:bg-osa-surface-2"
        >
          المنتجات
        </Link>
      </div>

      {/* Toolbar */}
      <div className={`${CARD} flex flex-wrap items-center gap-2.5 p-[14px_16px]`}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم المنتج أو SKU…"
          className="flex-1 min-w-[200px] rounded-full border border-osa-border bg-osa-surface-2 px-4 py-[8px] text-[13px] text-osa-ink placeholder:text-osa-faint focus:border-osa-brand-border focus:outline-none focus:ring-2 focus:ring-osa-brand-border"
        />
        <button
          type="button"
          onClick={() => setOnlyLow((v) => !v)}
          className={
            'rounded-full border px-[14px] py-[6px] text-[12.5px] font-semibold transition-colors ' +
            (onlyLow ? 'border-osa-amber bg-osa-amber-dim text-osa-amber' : 'border-osa-border bg-osa-surface text-osa-muted hover:bg-osa-surface-2')
          }
        >
          منخفض المخزون <span className="num">({int(lowCount)})</span>
        </button>
      </div>

      {/* Table */}
      <div className={`${CARD} overflow-hidden`}>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className="text-[14px] font-semibold text-osa-ink">لا توجد سجلات مطابقة</p>
            {(onlyLow || q) && (
              <GhostButton onClick={() => { setOnlyLow(false); setQ(''); }}>مسح الفلاتر</GhostButton>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-osa-border">
                <Th className="ps-4">المنتج</Th>
                <Th>SKU</Th>
                <Th>الخصائص</Th>
                <Th className="text-end">المحجوز</Th>
                <Th className="text-end">المتاح</Th>
                <Th className="text-end pe-4">المتوفر (تعديل)</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const low = r.available <= r.lowThreshold;
                const out = r.available <= 0;
                const value = draft[r.variantId] ?? String(r.onHand);
                return (
                  <tr key={r.variantId} className={'border-b border-osa-border last:border-none hover:bg-osa-surface-2 ' + (out ? 'bg-osa-rose-dim/30' : low ? 'bg-osa-amber-dim/20' : '')}>
                    <td className="ps-4 py-[10px] align-middle font-medium text-osa-ink">
                      {locale === 'ar' ? r.productNameAr : r.productNameEn || r.productNameAr}
                    </td>
                    <td className="num py-[10px] align-middle text-osa-muted">{r.sku ?? '—'}</td>
                    <td className="py-[10px] align-middle text-[12px] text-osa-muted">
                      {Object.entries(r.attributes).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}
                    </td>
                    <td className="num py-[10px] align-middle text-end text-osa-muted">{int(r.reserved)}</td>
                    <td className="py-[10px] align-middle text-end">
                      <span className={'num font-semibold ' + (out ? 'text-osa-rose' : low ? 'text-osa-amber' : 'text-osa-ink')}>
                        {int(r.available)}
                      </span>
                    </td>
                    <td className="py-[10px] pe-4 align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        <Stepper label="−" onClick={() => step(r.variantId, r.onHand, -1)} disabled={r.onHand <= 0} />
                        <input
                          value={value}
                          onChange={(e) => setDraft((d) => ({ ...d, [r.variantId]: e.target.value }))}
                          onBlur={() => commit(r.variantId, r.onHand)}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          inputMode="numeric"
                          className="num w-16 rounded-md border border-osa-border bg-osa-surface px-2 py-[5px] text-center text-[12.5px] text-osa-ink focus:border-osa-brand-border focus:outline-none"
                        />
                        <Stepper label="+" onClick={() => step(r.variantId, r.onHand, 1)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!data.live && <p className="px-1 text-[11px] text-osa-faint">بيانات تجريبية</p>}
    </div>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-2 pb-[10px] pt-3 text-start text-[11.5px] font-semibold text-osa-faint ${className}`}>{children}</th>;
}

function Stepper({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="grid h-7 w-7 place-items-center rounded-md border border-osa-border bg-osa-surface text-[14px] font-semibold text-osa-muted transition-colors hover:bg-osa-surface-2 disabled:opacity-40"
      aria-label={label === '+' ? 'زيادة' : 'إنقاص'}
    >
      {label}
    </button>
  );
}
