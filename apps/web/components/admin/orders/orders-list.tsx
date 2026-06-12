'use client';

/**
 * OSALPHA gold orders list — DataTable matching the design system:
 * 4 KPI cards, filter chips + search + bulk-action bar, a sortable sticky-header
 * hairline table with per-row hover actions, and a pagination footer. Clicking a
 * row (or the view action) opens the order detail in a slide-over drawer.
 */
import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { StatusPill, PayChip } from '@elite/ui/web';
import type { OrderStatus } from '@elite/types';
import type { AdminOrdersData, AdminOrderRow, AdminOrderDetail } from '@/lib/admin-orders';
import { useLocale } from '@/components/providers';
import { num3, int, shortDateTime } from './format';
import { STATUS_LABEL, STATUS_TONE, CHANNEL_LABEL, FILTER_CHIPS } from './status';
import { OsaToastProvider, useOsaToast } from './toast';
import { OrderDetail } from './order-detail';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';
const PAGE_SIZE = 8;

type SortKey = 'number' | 'customer' | 'total' | 'placedAt';
type SortDir = 'asc' | 'desc';

export function OrdersList({ data, details }: { data: AdminOrdersData; details: Record<string, AdminOrderDetail> }) {
  return (
    <OsaToastProvider>
      <OrdersListInner data={data} details={details} />
    </OsaToastProvider>
  );
}

function OrdersListInner({ data, details }: { data: AdminOrdersData; details: Record<string, AdminOrderDetail> }) {
  const { locale } = useLocale();
  const ar = locale === 'ar';
  const { toast } = useOsaToast();

  const [chip, setChip] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'placedAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  const matcher = FILTER_CHIPS.find((c) => c.key === chip) ?? FILTER_CHIPS[0]!;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = data.rows.filter(
      (r) =>
        matcher.match(r.status) &&
        (!needle ||
          r.number.toLowerCase().includes(needle) ||
          r.customer.toLowerCase().includes(needle) ||
          r.itemsLabel.toLowerCase().includes(needle)),
    );
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const k = sort.key;
      if (k === 'total') return (a.total - b.total) * dir;
      if (k === 'placedAt') return (new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime()) * dir;
      return String(a[k]).localeCompare(String(b[k]), 'ar') * dir;
    });
  }, [data.rows, matcher, q, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pageIds = pageRows.map((r) => r.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }
  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }
  function bulk(action: string) {
    toast(`${action} · ${selected.size} طلبات`, 'info');
    setSelected(new Set());
  }

  const openDetail = openId ? details[openId] ?? null : null;

  const kpis = data.kpis;

  return (
    <div className="space-y-[14px]">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-[21px] font-bold text-osa-ink" style={{ fontFamily: 'var(--font-cairo)' }}>
            الطلبات
          </h1>
          <p className="text-[12.5px] text-osa-faint">
            <span className="num">{int(filtered.length)}</span> طلب · إدارة ومتابعة كل القنوات
          </p>
        </div>
        <button
          type="button"
          onClick={() => toast('إنشاء طلب جديد (تجريبي)', 'info')}
          className="osa-btn-primary ms-auto rounded-full bg-osa-brand px-4 py-2 text-[13px] font-semibold text-white transition-transform active:scale-[.97]"
        >
          + طلب جديد
        </button>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
        <Kpi tone="blue" label="طلبات اليوم" value={<span className="num">{int(kpis.ordersToday)}</span>} icon="M3 3h2l2 13h11l2-9H7" />
        <Kpi
          tone="brand"
          label="إيرادات اليوم"
          value={<span className="num">{num3(kpis.revenueToday)} <span className="text-[12px] font-semibold text-osa-faint">د.ك</span></span>}
          icon="M4 20V10M10 20V4M16 20v-7M21 20H3"
        />
        <Kpi tone="amber" label="قيد التوصيل" value={<span className="num">{int(kpis.outForDelivery)}</span>} icon="M3 6h13v9H3zM16 9h4l1 3v3h-5" />
        <Kpi tone="green" label="بانتظار التركيب" value={<span className="num">{int(kpis.awaitingInstall)}</span>} icon="M12 7.5V12l3 2.5" iconCircle />
      </div>

      {/* Toolbar: filter chips + search */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                setChip(c.key);
                setPage(1);
              }}
              className={
                'rounded-full px-3.5 py-[6px] text-[12.5px] font-semibold transition-colors ' +
                (chip === c.key
                  ? 'bg-osa-brand-dim text-osa-brand'
                  : 'border border-osa-border text-osa-muted hover:border-osa-brand-border')
              }
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="ms-auto flex items-center gap-2 rounded-full border border-osa-border bg-osa-surface px-3.5 py-2 shadow-osa">
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-osa-faint" aria-hidden>
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="بحث برقم الطلب أو العميل…"
            className="w-44 bg-transparent text-[13px] text-osa-ink outline-none placeholder:text-osa-faint"
          />
        </div>
      </div>

      {/* Bulk-action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-osa border border-osa-brand-border bg-osa-brand-dim px-4 py-2.5">
          <span className="text-[13px] font-semibold text-osa-brand">
            <span className="num">{int(selected.size)}</span> محدد
          </span>
          <div className="ms-auto flex flex-wrap gap-2">
            {['تحديث الحالة', 'طباعة الفواتير', 'تصدير'].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => bulk(b)}
                className="rounded-full bg-osa-surface px-3 py-1.5 text-[12px] font-semibold text-osa-brand transition-transform active:scale-[.97]"
              >
                {b}
              </button>
            ))}
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-full px-2 py-1.5 text-[12px] font-semibold text-osa-muted">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={CARD + ' overflow-hidden'}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-osa-surface">
              <tr>
                <th className="border-b border-osa-border px-3 py-3 text-start">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} aria-label="تحديد الكل" className="accent-osa-brand" />
                </th>
                <SortTh label="الطلب" k="number" sort={sort} onSort={toggleSort} />
                <SortTh label="العميل" k="customer" sort={sort} onSort={toggleSort} />
                <Th>القناة</Th>
                <Th>المنتجات</Th>
                <SortTh label="الإجمالي" k="total" sort={sort} onSort={toggleSort} />
                <Th>الحالة</Th>
                <Th>الدفع</Th>
                <SortTh label="التاريخ" k="placedAt" sort={sort} onSort={toggleSort} />
                <Th className="text-end">إجراءات</Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-14 text-center">
                    <div className="text-[14px] font-semibold text-osa-ink">لا توجد طلبات مطابقة</div>
                    <button
                      type="button"
                      onClick={() => {
                        setChip('all');
                        setQ('');
                      }}
                      className="mt-2 text-[12.5px] font-semibold text-osa-brand"
                    >
                      مسح عوامل التصفية
                    </button>
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <Row
                    key={r.id}
                    row={r}
                    locale={locale}
                    selected={selected.has(r.id)}
                    onToggle={() => toggleRow(r.id)}
                    onOpen={() => setOpenId(r.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex flex-wrap items-center gap-3 border-t border-osa-border px-4 py-3 text-[12.5px] text-osa-muted">
          <span>
            صفحة <span className="num">{safePage}</span> من <span className="num">{pageCount}</span>
          </span>
          <div className="ms-auto flex items-center gap-1.5">
            <PagerBtn disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              السابق
            </PagerBtn>
            <PagerBtn disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
              التالي
            </PagerBtn>
          </div>
        </div>
      </div>

      {!data.live && <p className="px-1 text-[11px] text-osa-faint">{ar ? 'بيانات تجريبية' : 'sample data'}</p>}

      {/* Detail drawer */}
      {openId && openDetail && <DetailDrawer onClose={() => setOpenId(null)} detail={openDetail} />}
    </div>
  );
}

function Row({
  row,
  locale,
  selected,
  onToggle,
  onOpen,
}: {
  row: AdminOrderRow;
  locale: string;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <tr className={'group transition-colors hover:bg-osa-surface-2 ' + (selected ? 'bg-osa-brand-dim' : '')}>
      <td className="border-b border-osa-border px-3 py-2.5 align-middle">
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`تحديد ${row.number}`} className="accent-osa-brand" />
      </td>
      <td className="border-b border-osa-border px-3 py-2.5 align-middle">
        <button type="button" onClick={onOpen} className="num font-semibold text-osa-brand hover:underline">
          {row.number}
        </button>
      </td>
      <td className="border-b border-osa-border px-3 py-2.5 align-middle text-osa-ink">{row.customer}</td>
      <td className="border-b border-osa-border px-3 py-2.5 align-middle text-osa-muted">{CHANNEL_LABEL[row.channel]}</td>
      <td className="border-b border-osa-border px-3 py-2.5 align-middle text-osa-muted">
        <span className="num me-1.5 text-osa-ink">{row.items}</span>
        <span className="text-[12px]">{row.itemsLabel}</span>
      </td>
      <td className="num border-b border-osa-border px-3 py-2.5 align-middle font-semibold text-osa-ink">
        {num3(row.total)} <span className="text-[10.5px] font-normal text-osa-faint">د.ك</span>
      </td>
      <td className="border-b border-osa-border px-3 py-2.5 align-middle">
        <StatusPill tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</StatusPill>
      </td>
      <td className="border-b border-osa-border px-3 py-2.5 align-middle">
        <PayChip>{row.pay}</PayChip>
      </td>
      <td className="num border-b border-osa-border px-3 py-2.5 align-middle text-osa-muted">{shortDateTime(row.placedAt)}</td>
      <td className="border-b border-osa-border px-3 py-2.5 align-middle">
        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <IconBtn label="عرض" onClick={onOpen}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" aria-hidden>
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
            </svg>
          </IconBtn>
          <Link
            href={`/${locale}/admin/orders/${row.id}`}
            aria-label="تعديل"
            className="grid h-7 w-7 place-items-center rounded-osa-sm text-osa-muted hover:bg-osa-surface hover:text-osa-brand"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <IconBtn label="المزيد" onClick={onOpen}>
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
            </svg>
          </IconBtn>
        </div>
      </td>
    </tr>
  );
}

function DetailDrawer({ detail, onClose }: { detail: AdminOrderDetail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div className="absolute inset-y-0 end-0 flex w-full max-w-[560px] flex-col bg-osa-canvas shadow-osa">
        <div className="flex items-center justify-between border-b border-osa-border bg-osa-surface px-5 py-3.5">
          <span className="text-[14px] font-bold text-osa-ink" style={{ fontFamily: 'var(--font-cairo)' }}>
            تفاصيل الطلب
          </span>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-8 w-8 place-items-center rounded-full text-osa-muted hover:bg-osa-surface-2">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <OrderDetail detail={detail} />
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <th className={'border-b border-osa-border px-3 pb-3 pt-3 text-start text-[11px] font-medium text-osa-faint ' + className}>{children}</th>;
}

function SortTh({
  label,
  k,
  sort,
  onSort,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (k: SortKey) => void;
}) {
  const active = sort.key === k;
  return (
    <th className="border-b border-osa-border px-3 pb-3 pt-3 text-start text-[11px] font-medium text-osa-faint">
      <button type="button" onClick={() => onSort(k)} className={'inline-flex items-center gap-1 ' + (active ? 'text-osa-brand' : 'hover:text-osa-muted')}>
        {label}
        <span aria-hidden className="text-[9px]">{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

function PagerBtn({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-osa-sm border border-osa-border px-3 py-1.5 text-[12.5px] font-semibold text-osa-muted transition-colors hover:border-osa-brand-border hover:text-osa-brand disabled:opacity-40 disabled:hover:border-osa-border disabled:hover:text-osa-muted"
    >
      {children}
    </button>
  );
}

function IconBtn({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="grid h-7 w-7 place-items-center rounded-osa-sm text-osa-muted hover:bg-osa-surface hover:text-osa-brand">
      {children}
    </button>
  );
}

function Kpi({
  tone,
  label,
  value,
  icon,
  iconCircle,
}: {
  tone: 'brand' | 'blue' | 'green' | 'amber';
  label: string;
  value: ReactNode;
  icon: string;
  iconCircle?: boolean;
}) {
  const toneBg: Record<string, string> = {
    brand: 'bg-osa-brand-dim text-osa-brand',
    blue: 'bg-osa-blue-dim text-osa-blue',
    green: 'bg-osa-green-dim text-osa-green',
    amber: 'bg-osa-amber-dim text-osa-amber',
  };
  return (
    <div className="flex items-start gap-[13px] rounded-osa border border-osa-border bg-osa-surface p-[16px_18px] shadow-osa">
      <div className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-[12px] ${toneBg[tone]}`}>
        <svg width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
          {iconCircle && <circle cx="12" cy="12" r="9" />}
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-osa-muted">{label}</div>
        <div className="text-[23px] font-bold leading-[1.3] text-osa-ink" style={{ fontFamily: 'var(--font-cairo)' }}>
          {value}
        </div>
      </div>
    </div>
  );
}
