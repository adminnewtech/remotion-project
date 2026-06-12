'use client';

/**
 * OSALPHA products list — gold DataTable with KPI strip, category + stock-state
 * filter chips, search, sort, pagination, bulk publish/hide bar, per-row status
 * toggle, and the gold "+ منتج جديد" action. Wired to the catalog data seam;
 * writes go through the server actions with optimistic update + toast.
 */
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Category } from '@elite/types';
import { useT } from '@/lib/use-t';
import { localized } from '@/lib/i18n';
import type { CatalogProduct } from '@/lib/admin-catalog';
import { setProductActive, setProductsActive } from './actions';
import {
  Money,
  StockPill,
  StatusToggle,
  GoldButton,
  int,
  kwd,
  useToast,
} from './shared';

const PAGE_SIZE = 8;
const LOW = 5;

type StockState = 'all' | 'in' | 'low' | 'out';
type SortKey = 'name' | 'price' | 'stock';
type SortDir = 'asc' | 'desc';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';

export function CatalogList({
  data,
}: {
  data: { live: boolean; products: CatalogProduct[]; categories: Category[] };
}) {
  const { locale } = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  // Optimistic active-state overrides keyed by product id.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const products = useMemo(
    () => data.products.map((p) => ({ ...p, is_active: overrides[p.id] ?? p.is_active })),
    [data.products, overrides],
  );

  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<StockState>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── KPIs (over the full set, not the filtered view) ──
  const kpis = useMemo(() => {
    const total = products.length;
    const low = products.filter((p) => p.stock > 0 && p.stock <= LOW).length;
    const hidden = products.filter((p) => !p.is_active).length;
    const value = products.reduce((sum, p) => sum + p.stock * (p.salePrice ?? p.price), 0);
    return { total, low, hidden, value };
  }, [products]);

  // ── Filter + sort ──
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = products.filter((p) => {
      if (catFilter !== 'all' && p.category_id !== catFilter) return false;
      if (stockFilter === 'in' && !(p.stock > LOW)) return false;
      if (stockFilter === 'low' && !(p.stock > 0 && p.stock <= LOW)) return false;
      if (stockFilter === 'out' && p.stock > 0) return false;
      if (term) {
        const hay = `${p.name_ar} ${p.name_en} ${p.brand ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = localized(a, 'name', locale).localeCompare(localized(b, 'name', locale), 'ar');
      else if (sortKey === 'price') cmp = (a.salePrice ?? a.price) - (b.salePrice ?? b.price);
      else cmp = a.stock - b.stock;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [products, q, catFilter, stockFilter, sortKey, sortDir, locale]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, pageCount);
  const pageItems = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  const allOnPageSelected = pageItems.length > 0 && pageItems.every((p) => selected.has(p.id));

  function resetPage() {
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function toggleRow(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected((s) => {
      const next = new Set(s);
      if (allOnPageSelected) pageItems.forEach((p) => next.delete(p.id));
      else pageItems.forEach((p) => next.add(p.id));
      return next;
    });
  }

  function onToggleActive(id: string, next: boolean) {
    const prev = products.find((p) => p.id === id)?.is_active ?? true;
    setOverrides((o) => ({ ...o, [id]: next }));
    startTransition(async () => {
      const res = await setProductActive(id, next);
      if (!res.ok) {
        setOverrides((o) => ({ ...o, [id]: prev }));
        toast('تعذّر تحديث الحالة', { tone: 'error' });
      } else {
        toast(next ? 'تم نشر المنتج' : 'تم إخفاء المنتج', {
          tone: 'success',
          undo: () => onToggleActive(id, prev),
        });
      }
    });
  }

  function onBulk(active: boolean) {
    const ids = [...selected];
    if (!ids.length) return;
    setOverrides((o) => {
      const next = { ...o };
      ids.forEach((id) => (next[id] = active));
      return next;
    });
    setSelected(new Set());
    startTransition(async () => {
      const res = await setProductsActive(ids, active);
      if (!res.ok) toast('تعذّر التحديث الجماعي', { tone: 'error' });
      else toast(active ? `تم نشر ${int(ids.length)} منتجات` : `تم إخفاء ${int(ids.length)} منتجات`, { tone: 'success' });
    });
  }

  const categories = data.categories;

  return (
    <div className="space-y-[14px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-osa-ink">المنتجات والمخزون</h1>
          <p className="text-[13px] text-osa-muted">إدارة الكتالوج، الأسعار، والمخزون</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/admin/catalog/inventory`}
            className="inline-flex items-center gap-2 rounded-full border border-osa-border-strong bg-osa-surface px-4 py-[9px] text-[13px] font-semibold text-osa-muted transition-colors hover:bg-osa-surface-2"
          >
            المخزون
          </Link>
          <GoldButton onClick={() => router.push(`/${locale}/admin/catalog/new`)}>
            <span className="text-[16px] leading-none">+</span> منتج جديد
          </GoldButton>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-4">
        <Kpi tone="brand" label="إجمالي المنتجات" value={<span className="num">{int(kpis.total)}</span>} />
        <Kpi tone="amber" label="منخفض المخزون" value={<span className="num text-osa-amber">{int(kpis.low)}</span>} />
        <Kpi tone="blue" label="غير منشور" value={<span className="num">{int(kpis.hidden)}</span>} />
        <Kpi
          tone="green"
          label="قيمة المخزون"
          value={
            <span className="num">
              {kwd(kpis.value)} <span className="text-[12px] font-semibold text-osa-faint">د.ك</span>
            </span>
          }
        />
      </div>

      {/* Toolbar */}
      <div className={`${CARD} p-[14px_16px]`}>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg
              className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-osa-faint"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                resetPage();
              }}
              placeholder="ابحث باسم المنتج أو العلامة…"
              className="w-full rounded-full border border-osa-border bg-osa-surface-2 py-[8px] ps-9 pe-3 text-[13px] text-osa-ink placeholder:text-osa-faint focus:border-osa-brand-border focus:outline-none focus:ring-2 focus:ring-osa-brand-border"
            />
          </div>
          {/* Sort */}
          <div className="flex items-center gap-1 rounded-full bg-osa-surface-2 p-[3px]">
            {([
              ['name', 'الاسم'],
              ['price', 'السعر'],
              ['stock', 'المخزون'],
            ] as [SortKey, string][]).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => toggleSort(k)}
                className={
                  'rounded-full px-[12px] py-[4px] text-[12px] font-semibold transition-colors ' +
                  (sortKey === k ? 'bg-osa-surface text-osa-ink shadow-osa' : 'text-osa-muted')
                }
              >
                {label}
                {sortKey === k && <span className="ms-1 text-osa-brand">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Filter chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip active={catFilter === 'all' && stockFilter === 'all'} onClick={() => { setCatFilter('all'); setStockFilter('all'); resetPage(); }}>
            الكل
          </Chip>
          <span className="mx-1 h-4 w-px bg-osa-border" />
          {categories.map((c) => (
            <Chip key={c.id} active={catFilter === c.id} onClick={() => { setCatFilter((v) => (v === c.id ? 'all' : c.id)); resetPage(); }}>
              {localized(c, 'name', locale)}
            </Chip>
          ))}
          <span className="mx-1 h-4 w-px bg-osa-border" />
          {([
            ['in', 'متوفر'],
            ['low', 'منخفض'],
            ['out', 'نافد'],
          ] as [StockState, string][]).map(([k, label]) => (
            <Chip key={k} active={stockFilter === k} tone="stock" onClick={() => { setStockFilter((v) => (v === k ? 'all' : k)); resetPage(); }}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-osa border border-osa-brand-border bg-osa-brand-dim px-4 py-[10px] text-[13px]">
          <span className="font-semibold text-osa-brand">
            <span className="num">{int(selected.size)}</span> محدد
          </span>
          <div className="ms-auto flex items-center gap-2">
            <button type="button" onClick={() => onBulk(true)} className="rounded-full bg-osa-surface px-[14px] py-[5px] text-[12px] font-semibold text-osa-green">
              نشر
            </button>
            <button type="button" onClick={() => onBulk(false)} className="rounded-full bg-osa-surface px-[14px] py-[5px] text-[12px] font-semibold text-osa-muted">
              إخفاء
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-[12px] font-semibold text-osa-faint">
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={`${CARD} overflow-hidden`}>
        {pageItems.length === 0 ? (
          <EmptyState onClear={() => { setQ(''); setCatFilter('all'); setStockFilter('all'); resetPage(); }} filtered={products.length > 0} locale={locale} onAdd={() => router.push(`/${locale}/admin/catalog/new`)} />
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-osa-border">
                <Th className="w-10 ps-4">
                  <Checkbox checked={allOnPageSelected} onChange={toggleAllOnPage} ariaLabel="تحديد الكل" />
                </Th>
                <Th>صورة</Th>
                <Th>المنتج</Th>
                <Th>الفئة</Th>
                <Th className="text-end">السعر</Th>
                <Th className="text-end">المخزون</Th>
                <Th>الحالة</Th>
                <Th className="text-end pe-4">إجراءات</Th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p) => {
                const isSel = selected.has(p.id);
                return (
                  <tr
                    key={p.id}
                    className={'border-b border-osa-border transition-colors last:border-none hover:bg-osa-surface-2 ' + (isSel ? 'bg-osa-brand-dim/40' : '')}
                  >
                    <td className="ps-4 align-middle">
                      <Checkbox checked={isSel} onChange={() => toggleRow(p.id)} ariaLabel="تحديد الصف" />
                    </td>
                    <td className="py-[10px] align-middle">
                      <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-osa-sm border border-osa-border bg-osa-surface-2">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <span className="text-osa-faint">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-[10px] align-middle">
                      <Link href={`/${locale}/admin/catalog/${p.id}`} className="block">
                        <div className="font-medium text-osa-ink hover:text-osa-brand">{localized(p, 'name', locale)}</div>
                        {p.brand && <div className="text-[11.5px] text-osa-faint">{p.brand}</div>}
                      </Link>
                    </td>
                    <td className="py-[10px] align-middle text-osa-muted">
                      {(locale === 'ar' ? p.categoryNameAr : p.categoryNameEn) ?? '—'}
                    </td>
                    <td className="py-[10px] align-middle text-end">
                      <Money price={p.price} salePrice={p.salePrice} />
                    </td>
                    <td className="py-[10px] align-middle text-end">
                      <StockPill stock={p.stock} threshold={LOW} />
                    </td>
                    <td className="py-[10px] align-middle">
                      <StatusToggle active={p.is_active} onChange={(next) => onToggleActive(p.id, next)} />
                    </td>
                    <td className="py-[10px] pe-4 align-middle text-end">
                      <Link
                        href={`/${locale}/admin/catalog/${p.id}`}
                        className="inline-flex items-center rounded-full px-[12px] py-[5px] text-[12px] font-semibold text-osa-brand transition-colors hover:bg-osa-brand-dim"
                      >
                        تعديل
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-[12.5px] text-osa-muted">
          <span className="num">
            {(pageClamped - 1) * PAGE_SIZE + 1}–{Math.min(pageClamped * PAGE_SIZE, filtered.length)} من {filtered.length}
          </span>
          <div className="flex items-center gap-1.5">
            <PagerBtn disabled={pageClamped <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>السابق</PagerBtn>
            <span className="num px-2 font-semibold text-osa-ink">{pageClamped} / {pageCount}</span>
            <PagerBtn disabled={pageClamped >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>التالي</PagerBtn>
          </div>
        </div>
      )}

      {!data.live && <p className="px-1 text-[11px] text-osa-faint">بيانات تجريبية</p>}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function Kpi({ tone, label, value }: { tone: 'brand' | 'blue' | 'green' | 'amber'; label: string; value: React.ReactNode }) {
  const dot: Record<string, string> = {
    brand: 'bg-osa-brand-dim text-osa-brand',
    blue: 'bg-osa-blue-dim text-osa-blue',
    green: 'bg-osa-green-dim text-osa-green',
    amber: 'bg-osa-amber-dim text-osa-amber',
  };
  return (
    <div className={`${CARD} flex items-center gap-3 p-[16px_18px]`}>
      <span className={`h-9 w-1.5 flex-shrink-0 rounded-full ${dot[tone]}`} aria-hidden />
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-osa-muted">{label}</div>
        <div className="text-[22px] font-bold leading-tight text-osa-ink" style={{ fontFamily: 'var(--font-cairo)' }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  tone = 'default',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'default' | 'stock';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-full border px-[13px] py-[5px] text-[12px] font-semibold transition-colors ' +
        (active
          ? 'border-osa-brand-border bg-osa-brand-dim text-osa-brand'
          : 'border-osa-border bg-osa-surface text-osa-muted hover:bg-osa-surface-2')
      }
    >
      {children}
    </button>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-2 pb-[10px] pt-3 text-start text-[11.5px] font-semibold text-osa-faint ${className}`}>{children}</th>;
}

function Checkbox({ checked, onChange, ariaLabel }: { checked: boolean; onChange: () => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={
        'grid h-[18px] w-[18px] place-items-center rounded-[5px] border-[1.5px] text-[11px] transition-colors ' +
        (checked ? 'border-osa-brand bg-osa-brand text-white' : 'border-osa-border-strong text-transparent hover:border-osa-brand')
      }
    >
      ✓
    </button>
  );
}

function PagerBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-osa-border bg-osa-surface px-[14px] py-[5px] text-[12px] font-semibold text-osa-muted transition-colors hover:bg-osa-surface-2 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function EmptyState({
  onClear,
  onAdd,
  filtered,
  locale,
}: {
  onClear: () => void;
  onAdd: () => void;
  filtered: boolean;
  locale: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-osa bg-osa-surface-2 text-osa-faint">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {filtered ? (
        <>
          <p className="text-[14px] font-semibold text-osa-ink">لا توجد نتائج مطابقة</p>
          <button type="button" onClick={onClear} className="text-[13px] font-semibold text-osa-brand">مسح الفلاتر</button>
        </>
      ) : (
        <>
          <p className="text-[14px] font-semibold text-osa-ink">{locale === 'ar' ? 'لا توجد منتجات بعد' : 'No products yet'}</p>
          <GoldButton onClick={onAdd}><span className="text-[16px] leading-none">+</span> منتج جديد</GoldButton>
        </>
      )}
    </div>
  );
}
