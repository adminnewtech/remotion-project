'use client';

/**
 * OSALPHA gold journal ledger — دفتر اليومية
 * Shows: summary KPIs, trial balance grouped by account kind, recent journal
 * entries with expandable lines, date-range + source-kind filters.
 * Includes "إعادة الترحيل" button that calls the accounting-poster edge function.
 */

import { useState } from 'react';
import type { LedgerData, JournalEntryRow, TrialBalanceRow } from '@/lib/admin-accounting-ledger';
import { num3 } from '@/components/admin/orders/format';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface p-[17px_19px] shadow-osa';

const KIND_LABEL: Record<string, string> = {
  asset: 'الأصول',
  liability: 'الالتزامات',
  equity: 'حقوق الملكية',
  revenue: 'الإيرادات',
  expense: 'المصروفات',
};

const KIND_ORDER = ['asset', 'liability', 'equity', 'revenue', 'expense'];

const SOURCE_LABELS: Record<string, string> = {
  payment: 'دفعة',
  refund: 'استرداد',
  expense: 'مصروف',
  supplier_payment: 'دفع مورد',
  order_cogs: 'تكلفة مبيعات',
  order_discount: 'خصم طلب',
  stock_adjust: 'تسوية مخزون',
  knet_settlement: 'تسوية كي-نت',
  cod_remittance: 'تسليم COD',
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-osa-green' : 'bg-osa-amber'}`}
      title={ok ? 'بيانات حية' : 'بيانات تجريبية'}
    />
  );
}

function KindBadge({ kind }: { kind: string }) {
  const colors: Record<string, string> = {
    asset: 'bg-blue-50 text-blue-700',
    liability: 'bg-orange-50 text-orange-700',
    equity: 'bg-purple-50 text-purple-700',
    revenue: 'bg-green-50 text-green-700',
    expense: 'bg-red-50 text-red-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${colors[kind] ?? 'bg-gray-50 text-gray-700'}`}>
      {KIND_LABEL[kind] ?? kind}
    </span>
  );
}

function TrialBalanceSection({ rows }: { rows: TrialBalanceRow[] }) {
  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    rows: rows.filter((r) => r.kind === kind),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className={CARD}>
      <h2 className="mb-4 text-[15px] font-bold text-osa-ink">ميزان المراجعة</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-osa-border text-osa-muted">
              <th className="pb-2 text-start font-medium">الحساب</th>
              <th className="pb-2 text-start font-medium">الاسم</th>
              <th className="pb-2 text-end font-medium">مدين</th>
              <th className="pb-2 text-end font-medium">دائن</th>
              <th className="pb-2 text-end font-medium">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ kind, rows: kindRows }) => (
              <>
                <tr key={`header-${kind}`} className="bg-osa-bg/40">
                  <td colSpan={5} className="py-2 ps-1 text-[12px] font-bold text-osa-muted uppercase tracking-wide">
                    {KIND_LABEL[kind] ?? kind}
                  </td>
                </tr>
                {kindRows.map((r) => (
                  <tr key={r.code} className="border-b border-osa-border/50 hover:bg-osa-bg/30 transition-colors">
                    <td className="py-2 font-mono text-[12px] text-osa-muted">{r.code}</td>
                    <td className="py-2 text-osa-ink">{r.nameAr}</td>
                    <td className="py-2 text-end font-mono">
                      {r.totalDebit > 0 ? (
                        <span className="text-osa-ink">{num3(r.totalDebit)}</span>
                      ) : (
                        <span className="text-osa-faint">—</span>
                      )}
                    </td>
                    <td className="py-2 text-end font-mono">
                      {r.totalCredit > 0 ? (
                        <span className="text-osa-ink">{num3(r.totalCredit)}</span>
                      ) : (
                        <span className="text-osa-faint">—</span>
                      )}
                    </td>
                    <td className="py-2 text-end font-mono">
                      <span className={r.balance >= 0 ? 'text-osa-green font-semibold' : 'text-osa-rose font-semibold'}>
                        {num3(Math.abs(r.balance))}
                        {r.balance < 0 ? ' د' : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EntryRow({ entry }: { entry: JournalEntryRow }) {
  const [open, setOpen] = useState(false);
  const sourceLabel = SOURCE_LABELS[entry.sourceKind] ?? entry.sourceKind;

  return (
    <>
      <tr
        className="cursor-pointer border-b border-osa-border/50 hover:bg-osa-bg/30 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="py-2.5 font-mono text-[12px] text-osa-muted">#{entry.entryNo}</td>
        <td className="py-2.5 text-osa-ink max-w-[200px] truncate">{entry.memo ?? '—'}</td>
        <td className="py-2.5">
          <span className="rounded-full bg-osa-bg px-2 py-0.5 text-[11px] font-medium text-osa-muted">
            {sourceLabel}
          </span>
        </td>
        <td className="py-2.5 text-end font-mono text-[13px]">
          <span className="text-osa-ink">{num3(entry.totalDebit)}</span>
          <span className="ms-1 text-[10px] text-osa-faint">د.ك</span>
        </td>
        <td className="py-2.5 text-end text-[12px] text-osa-muted">
          {new Date(entry.postedAt).toLocaleDateString('ar-KW', { day: 'numeric', month: 'short', year: 'numeric' })}
        </td>
        <td className="py-2.5 text-center text-osa-muted">{open ? '▲' : '▼'}</td>
      </tr>
      {open && (
        <tr className="bg-osa-bg/20">
          <td colSpan={6} className="px-4 pb-3 pt-1">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-osa-faint">
                  <th className="pb-1 text-start font-normal">الحساب</th>
                  <th className="pb-1 text-end font-normal">مدين</th>
                  <th className="pb-1 text-end font-normal">دائن</th>
                  <th className="pb-1 text-start font-normal">بيان</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((line) => (
                  <tr key={line.id} className="border-t border-osa-border/30">
                    <td className="py-1 text-osa-ink">
                      <span className="font-mono text-osa-muted me-1">{line.accountCode}</span>
                      {line.accountName}
                    </td>
                    <td className="py-1 text-end font-mono">
                      {line.debit > 0 ? num3(line.debit) : <span className="text-osa-faint">—</span>}
                    </td>
                    <td className="py-1 text-end font-mono">
                      {line.credit > 0 ? num3(line.credit) : <span className="text-osa-faint">—</span>}
                    </td>
                    <td className="py-1 text-osa-muted">{line.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

export function JournalView({ data }: { data: LedgerData }) {
  const [replayStatus, setReplayStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [replayMsg, setReplayMsg] = useState('');

  const [sourceFilter, setSourceFilter] = useState('');
  const [searchMemo, setSearchMemo] = useState('');

  const netProfit = data.totalRevenue - data.totalExpense;

  const filteredEntries = data.recentEntries.filter((e) => {
    if (sourceFilter && e.sourceKind !== sourceFilter) return false;
    if (searchMemo && !e.memo?.includes(searchMemo)) return false;
    return true;
  });

  async function handleReplay() {
    setReplayStatus('loading');
    setReplayMsg('');
    try {
      const res = await fetch('/api/accounting-poster', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setReplayStatus('done');
      setReplayMsg(`تم ترحيل ${body.payments_posted ?? 0} قيد`);
    } catch (err) {
      setReplayStatus('error');
      setReplayMsg('فشل الاتصال بالوظيفة');
    }
  }

  return (
    <div className="space-y-[14px]" dir="rtl">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3.5">
        <div>
          <h1 className="text-[21px] font-bold text-osa-ink" style={{ fontFamily: 'var(--font-cairo)' }}>
            دفتر اليومية
          </h1>
          <p className="flex items-center gap-1.5 text-[12.5px] text-osa-faint">
            <StatusDot ok={data.live} />
            {data.live ? 'بيانات حية من قاعدة البيانات' : 'بيانات تجريبية — لا يوجد اتصال'}
          </p>
        </div>
        <div className="ms-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleReplay}
            disabled={replayStatus === 'loading'}
            className="flex items-center gap-1.5 rounded-full border border-osa-border bg-osa-surface px-4 py-2 text-[13px] font-semibold text-osa-muted shadow-osa transition-all hover:border-osa-brand hover:text-osa-brand active:scale-[.97] disabled:opacity-50"
          >
            {replayStatus === 'loading' ? '⏳ جارٍ الترحيل…' : '⟳ إعادة الترحيل'}
          </button>
          {replayMsg && (
            <span className={`text-[12px] font-medium ${replayStatus === 'done' ? 'text-osa-green' : 'text-osa-rose'}`}>
              {replayMsg}
            </span>
          )}
        </div>
      </header>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-[13px] sm:grid-cols-4">
        <div className={`${CARD} flex flex-col gap-1`}>
          <span className="text-[12px] text-osa-muted">إجمالي الأصول</span>
          <span className="text-[20px] font-bold text-osa-ink num">{num3(data.totalAssets)}</span>
          <span className="text-[10px] text-osa-faint">د.ك</span>
        </div>
        <div className={`${CARD} flex flex-col gap-1`}>
          <span className="text-[12px] text-osa-muted">الإيرادات</span>
          <span className="text-[20px] font-bold text-osa-green num">{num3(data.totalRevenue)}</span>
          <span className="text-[10px] text-osa-faint">د.ك</span>
        </div>
        <div className={`${CARD} flex flex-col gap-1`}>
          <span className="text-[12px] text-osa-muted">المصروفات</span>
          <span className="text-[20px] font-bold text-osa-rose num">{num3(data.totalExpense)}</span>
          <span className="text-[10px] text-osa-faint">د.ك</span>
        </div>
        <div className={`${CARD} flex flex-col gap-1`}>
          <span className="text-[12px] text-osa-muted">صافي الربح</span>
          <span className={`text-[20px] font-bold num ${netProfit >= 0 ? 'text-osa-green' : 'text-osa-rose'}`}>
            {num3(netProfit)}
          </span>
          <span className="text-[10px] text-osa-faint">د.ك</span>
        </div>
      </div>

      {/* Ledger delta alert */}
      {Math.abs(data.ledgerDelta) > 0.001 && (
        <div className="rounded-osa border border-osa-amber bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-800">
          ⚠️ فرق دفتري: {num3(data.ledgerDelta)} د.ك — الإيرادات التشغيلية لا تتطابق مع السجل المحاسبي
        </div>
      )}
      {data.live && Math.abs(data.ledgerDelta) <= 0.001 && (
        <div className="rounded-osa border border-osa-green/30 bg-green-50 px-4 py-3 text-[13px] font-medium text-green-700">
          ✓ الدفاتر متوازنة — لا يوجد فرق بين العمليات والسجل المحاسبي
        </div>
      )}

      {/* Trial Balance */}
      <TrialBalanceSection rows={data.trialBalance} />

      {/* Recent Journal Entries */}
      <div className={CARD}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-bold text-osa-ink">القيود الأخيرة</h2>
          <div className="ms-auto flex gap-2">
            <input
              type="text"
              placeholder="بحث في البيان…"
              value={searchMemo}
              onChange={(e) => setSearchMemo(e.target.value)}
              className="rounded-lg border border-osa-border bg-osa-bg px-3 py-1.5 text-[12px] text-osa-ink placeholder:text-osa-faint focus:outline-none focus:ring-1 focus:ring-osa-brand"
            />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-lg border border-osa-border bg-osa-bg px-3 py-1.5 text-[12px] text-osa-ink focus:outline-none focus:ring-1 focus:ring-osa-brand"
            >
              <option value="">كل الأنواع</option>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-osa-border text-osa-muted">
                <th className="pb-2 text-start font-medium w-16">#</th>
                <th className="pb-2 text-start font-medium">البيان</th>
                <th className="pb-2 text-start font-medium">النوع</th>
                <th className="pb-2 text-end font-medium">المبلغ</th>
                <th className="pb-2 text-end font-medium">التاريخ</th>
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-osa-faint text-[13px]">
                    لا توجد قيود
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e) => <EntryRow key={e.id} entry={e} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
