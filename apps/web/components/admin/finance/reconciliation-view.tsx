'use client';

/**
 * OSALPHA gold KNET reconciliation — التسوية البنكية
 * Features:
 *  - CSV upload → client-side parse → preview → حفظ وتطابق (server action)
 *  - Settlements table with match progress bar + status badge
 *  - Per-settlement detail drawer
 *  - "ترحيل" button on fully-matched settlements
 */

import { useState, useRef, type ChangeEvent } from 'react';
import type { ReconciliationData, KnetSettlementRow } from '@/lib/admin-accounting-ledger';
import { num3 } from '@/components/admin/orders/format';
import { uploadSettlement, matchSettlement, postSettlement } from '@/app/[locale]/admin/finance/reconciliation/actions';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface p-[17px_19px] shadow-osa';

interface CsvLine {
  gateway_ref: string;
  amount: number;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-gray-100 text-gray-600',
  matched: 'bg-blue-100 text-blue-700',
  posted: 'bg-green-100 text-green-700',
};
const STATUS_LABELS: Record<string, string> = {
  open: 'مفتوح',
  matched: 'متطابق',
  posted: 'مرحَّل',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function ProgressBar({ matched, total }: { matched: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((matched / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-osa-bg">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-osa-green' : 'bg-osa-brand'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[12px] text-osa-muted tabular-nums">{matched}/{total}</span>
    </div>
  );
}

function parseCsv(text: string): CsvLine[] {
  const lines = text.trim().split('\n');
  // Support formats: gateway_ref,amount OR just two columns
  // Skip header row if first cell is non-numeric
  const result: CsvLine[] = [];
  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim().replace(/"/g, ''));
    if (parts.length < 2) continue;
    const ref = parts[0] ?? '';
    const amt = parts[1] ?? '';
    const amount = parseFloat(amt);
    if (!ref || isNaN(amount)) continue;
    // Skip header
    if (isNaN(Number(ref.charAt(0))) && ref.toLowerCase().includes('ref')) continue;
    result.push({ gateway_ref: ref, amount });
  }
  return result;
}

function UploadSection({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<CsvLine[]>([]);
  const [header, setHeader] = useState({ date: '', gross: 0, fees: 0, bankRef: '', fileName: '' });
  const [status, setStatus] = useState<'idle' | 'preview' | 'uploading' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeader((h) => ({ ...h, fileName: file.name }));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = parseCsv(text);
      setPreview(lines);
      const gross = lines.reduce((s, l) => s + l.amount, 0);
      setHeader((h) => ({ ...h, gross: Math.round(gross * 1000) / 1000 }));
      setStatus('preview');
    };
    reader.readAsText(file);
  }

  async function handleSave() {
    if (preview.length === 0) return;
    setStatus('uploading');
    setMsg('');
    try {
      const result = await uploadSettlement({
        settleDate: header.date || new Date().toISOString().slice(0, 10),
        gross: header.gross,
        fees: header.fees,
        net: Math.round((header.gross - header.fees) * 1000) / 1000,
        bankRef: header.bankRef || null,
        fileName: header.fileName || null,
        lines: preview,
      });
      setStatus('done');
      const mr = result.matchResult as { matched?: number; amount_mismatch?: number; unmatched?: number } | null;
      setMsg(`تم الحفظ — ${mr?.matched ?? 0} متطابق, ${mr?.unmatched ?? 0} غير متطابق`);
      setPreview([]);
      onDone();
    } catch (err: unknown) {
      setStatus('error');
      setMsg(err instanceof Error ? err.message : 'خطأ غير معروف');
    }
  }

  return (
    <div className={CARD}>
      <h2 className="mb-4 text-[15px] font-bold text-osa-ink">رفع ملف تسوية كي-نت</h2>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-[12px] text-osa-muted">تاريخ التسوية</label>
          <input
            type="date"
            value={header.date}
            onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))}
            className="rounded-lg border border-osa-border bg-osa-bg px-3 py-1.5 text-[13px] text-osa-ink focus:outline-none focus:ring-1 focus:ring-osa-brand"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[12px] text-osa-muted">عمولة البوابة (د.ك)</label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={header.fees}
            onChange={(e) => setHeader((h) => ({ ...h, fees: parseFloat(e.target.value) || 0 }))}
            className="w-32 rounded-lg border border-osa-border bg-osa-bg px-3 py-1.5 text-[13px] text-osa-ink focus:outline-none focus:ring-1 focus:ring-osa-brand"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[12px] text-osa-muted">رقم المرجع البنكي</label>
          <input
            type="text"
            value={header.bankRef}
            onChange={(e) => setHeader((h) => ({ ...h, bankRef: e.target.value }))}
            placeholder="اختياري"
            className="rounded-lg border border-osa-border bg-osa-bg px-3 py-1.5 text-[13px] text-osa-ink placeholder:text-osa-faint focus:outline-none focus:ring-1 focus:ring-osa-brand"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-osa border-2 border-dashed border-osa-border p-5 hover:border-osa-brand transition-colors">
        <span className="text-[28px]">📂</span>
        <div>
          <p className="text-[13px] font-semibold text-osa-ink">اختر ملف CSV</p>
          <p className="text-[11.5px] text-osa-faint">تنسيق: gateway_ref, amount</p>
        </div>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
      </label>

      {status === 'preview' && preview.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[12.5px] text-osa-muted">
            معاينة: {preview.length} سطر — إجمالي {num3(header.gross)} د.ك
          </p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-osa-border">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-osa-surface">
                <tr className="border-b border-osa-border text-osa-muted">
                  <th className="px-3 py-2 text-start font-medium">مرجع البوابة</th>
                  <th className="px-3 py-2 text-end font-medium">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((l, i) => (
                  <tr key={i} className="border-b border-osa-border/40">
                    <td className="px-3 py-1.5 font-mono text-osa-muted">{l.gateway_ref}</td>
                    <td className="px-3 py-1.5 text-end font-mono">{num3(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={(status as string) === 'uploading'}
              className="rounded-full bg-osa-brand px-5 py-2 text-[13px] font-semibold text-white shadow-osa transition-transform active:scale-[.97] disabled:opacity-50"
            >
              {(status as string) === 'uploading' ? '⏳ جارٍ الحفظ…' : 'حفظ وتطابق'}
            </button>
            <button
              type="button"
              onClick={() => { setStatus('idle'); setPreview([]); }}
              className="text-[12px] text-osa-muted hover:text-osa-rose transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {(status === 'done' || status === 'error') && msg && (
        <p className={`mt-3 text-[12.5px] font-medium ${status === 'done' ? 'text-osa-green' : 'text-osa-rose'}`}>
          {status === 'done' ? '✓ ' : '✗ '}{msg}
        </p>
      )}
    </div>
  );
}

function SettlementsTable({
  settlements,
  onRefresh,
}: {
  settlements: KnetSettlementRow[];
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [msgMap, setMsgMap] = useState<Record<string, string>>({});

  async function handleMatch(id: string) {
    setMatchingId(id);
    try {
      const result = await matchSettlement(id);
      const r = result as { matched?: number; unmatched?: number; amount_mismatch?: number } | null;
      setMsgMap((m) => ({ ...m, [id]: `${r?.matched ?? 0} متطابق, ${r?.unmatched ?? 0} غير متطابق` }));
      onRefresh();
    } catch (err: unknown) {
      setMsgMap((m) => ({ ...m, [id]: err instanceof Error ? err.message : 'خطأ' }));
    } finally {
      setMatchingId(null);
    }
  }

  async function handlePost(id: string) {
    setPostingId(id);
    try {
      await postSettlement(id);
      setMsgMap((m) => ({ ...m, [id]: 'تم الترحيل بنجاح ✓' }));
      onRefresh();
    } catch (err: unknown) {
      setMsgMap((m) => ({ ...m, [id]: err instanceof Error ? err.message : 'خطأ' }));
    } finally {
      setPostingId(null);
    }
  }

  if (settlements.length === 0) {
    return (
      <div className={`${CARD} py-8 text-center text-osa-faint text-[13px]`}>
        لا توجد تسويات — ارفع ملف CSV لبدء التسوية
      </div>
    );
  }

  return (
    <div className={CARD}>
      <h2 className="mb-4 text-[15px] font-bold text-osa-ink">التسويات</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-osa-border text-osa-muted">
              <th className="pb-2 text-start font-medium">التاريخ</th>
              <th className="pb-2 text-end font-medium">الإجمالي</th>
              <th className="pb-2 text-end font-medium">العمولة</th>
              <th className="pb-2 text-end font-medium">الصافي</th>
              <th className="pb-2 text-start font-medium">التطابق</th>
              <th className="pb-2 text-start font-medium">الحالة</th>
              <th className="pb-2 w-24" />
            </tr>
          </thead>
          <tbody>
            {settlements.map((s) => (
              <>
                <tr
                  key={s.id}
                  className="cursor-pointer border-b border-osa-border/50 hover:bg-osa-bg/30 transition-colors"
                  onClick={() => setExpanded((e) => (e === s.id ? null : s.id))}
                >
                  <td className="py-2.5 font-mono text-[12px]">{s.settleDate}</td>
                  <td className="py-2.5 text-end font-mono">{num3(s.gross)}</td>
                  <td className="py-2.5 text-end font-mono text-osa-rose">{num3(s.fees)}</td>
                  <td className="py-2.5 text-end font-mono font-semibold">{num3(s.net)}</td>
                  <td className="py-2.5">
                    <ProgressBar matched={s.matchedLines} total={s.totalLines} />
                  </td>
                  <td className="py-2.5">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {s.status === 'open' && (
                        <button
                          type="button"
                          onClick={() => handleMatch(s.id)}
                          disabled={matchingId === s.id}
                          className="rounded-lg border border-osa-brand px-2.5 py-1 text-[11px] font-semibold text-osa-brand hover:bg-osa-brand hover:text-white transition-colors disabled:opacity-50"
                        >
                          {matchingId === s.id ? '⏳' : 'تطابق'}
                        </button>
                      )}
                      {s.status === 'matched' && (
                        <button
                          type="button"
                          onClick={() => handlePost(s.id)}
                          disabled={postingId === s.id}
                          className="rounded-lg border border-osa-green px-2.5 py-1 text-[11px] font-semibold text-osa-green hover:bg-osa-green hover:text-white transition-colors disabled:opacity-50"
                        >
                          {postingId === s.id ? '⏳' : 'ترحيل'}
                        </button>
                      )}
                    </div>
                    {msgMap[s.id] && (
                      <p className="mt-1 text-[11px] text-osa-muted">{msgMap[s.id]}</p>
                    )}
                  </td>
                </tr>
                {expanded === s.id && (
                  <tr key={`detail-${s.id}`} className="bg-osa-bg/20">
                    <td colSpan={7} className="px-4 pb-3 pt-2">
                      <p className="text-[12px] text-osa-muted">
                        {s.bankRef && <span>مرجع بنكي: <span className="font-mono">{s.bankRef}</span> · </span>}
                        {s.matchedLines} من {s.totalLines} سطر متطابقة
                      </p>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReconciliationView({ data }: { data: ReconciliationData }) {
  const [key, setKey] = useState(0);

  return (
    <div className="space-y-[14px]" dir="rtl">
      <header className="flex flex-wrap items-center gap-3.5">
        <div>
          <h1 className="text-[21px] font-bold text-osa-ink" style={{ fontFamily: 'var(--font-cairo)' }}>
            التسوية البنكية
          </h1>
          <p className="text-[12.5px] text-osa-faint">KNET Reconciliation</p>
        </div>
      </header>

      <UploadSection onDone={() => setKey((k) => k + 1)} />
      <SettlementsTable
        key={key}
        settlements={data.settlements}
        onRefresh={() => setKey((k) => k + 1)}
      />
    </div>
  );
}
