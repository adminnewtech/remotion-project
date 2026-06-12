'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/use-t';
import { PageHeader } from '@/components/admin/ui';
import { RoleGuard } from '@/components/role-guard';
import type { ApprovalsData, ApprovalRow } from '@/lib/admin-approvals';
import { approveAction, rejectAction } from './actions';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';

const AGENT_LABELS: Record<string, string> = {
  sales: 'مبيعات',
  ops: 'عمليات',
  insight: 'تحليلات',
  triage: 'تصنيف',
};

const RISK_COLORS: Record<string, string> = {
  حساس: 'bg-red-100 text-red-700',
  كتابة: 'bg-amber-100 text-amber-700',
  قراءة: 'bg-green-100 text-green-700',
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar-KW', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function InputSummary({ input }: { input: Record<string, unknown> }) {
  const entries = Object.entries(input).slice(0, 4);
  if (entries.length === 0) return <span className="text-osa-faint">—</span>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[12px]">
      {entries.map(([k, v]) => (
        <>
          <dt key={`k-${k}`} className="font-medium text-osa-muted">{k}:</dt>
          <dd key={`v-${k}`} className="truncate text-osa-ink">
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </dd>
        </>
      ))}
    </dl>
  );
}

interface RejectModalProps {
  row: ApprovalRow;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  pending: boolean;
}

function RejectModal({ row, onClose, onConfirm, pending }: RejectModalProps) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-osa-border bg-osa-surface p-6 shadow-xl">
        <h2 className="mb-1 text-[16px] font-bold text-osa-ink">رفض الإجراء</h2>
        <p className="mb-4 text-[13px] text-osa-muted">
          <span className="font-semibold text-osa-ink">{row.tool}</span> ·{' '}
          {AGENT_LABELS[row.agent] ?? row.agent}
        </p>
        <label className="mb-1 block text-[13px] font-medium text-osa-ink">
          سبب الرفض
        </label>
        <textarea
          className="mb-4 w-full rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="أدخل سبب الرفض..."
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-osa-border px-4 py-2 text-[13px] font-semibold text-osa-muted transition-colors hover:bg-osa-surface-2"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={pending}
            className="rounded-full bg-red-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'جارٍ الرفض…' : 'تأكيد الرفض ✗'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ActionCardProps {
  row: ApprovalRow;
  onApprove: (id: string) => void;
  onReject: (row: ApprovalRow) => void;
  approving: boolean;
}

function ActionCard({ row, onApprove, onReject, approving }: ActionCardProps) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-osa-brand-dim px-2.5 py-0.5 text-[12px] font-semibold text-osa-brand">
          {AGENT_LABELS[row.agent] ?? row.agent}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${RISK_COLORS[row.riskLabel] ?? 'bg-osa-surface-2 text-osa-muted'}`}
        >
          {row.riskLabel}
        </span>
        <span className="num ms-auto text-[11.5px] text-osa-faint">{formatDate(row.createdAt)}</span>
      </div>

      <p className="mb-2 font-mono text-[14px] font-semibold text-osa-ink">{row.tool}</p>
      <div className="mb-3 rounded-osa-sm bg-osa-surface-2 p-2.5">
        <InputSummary input={row.input} />
      </div>

      <p className="mb-3 text-[11px] text-osa-faint">
        جلسة: <span className="num font-mono">{row.sessionId.slice(0, 8)}…</span>
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onApprove(row.id)}
          disabled={approving}
          className="flex-1 rounded-full bg-green-600 py-2 text-[13px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {approving ? '…' : 'موافقة ✓'}
        </button>
        <button
          type="button"
          onClick={() => onReject(row)}
          disabled={approving}
          className="flex-1 rounded-full border border-red-300 bg-red-50 py-2 text-[13px] font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
        >
          رفض ✗
        </button>
      </div>
    </div>
  );
}

export function ApprovalsClient({ data }: { data: ApprovalsData }) {
  const { locale } = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingRow, setRejectingRow] = useState<ApprovalRow | null>(null);
  const [rejectPending, setRejectPending] = useState(false);

  const pendingCount = data.pending.length;

  function handleApprove(id: string) {
    setApprovingId(id);
    startTransition(async () => {
      try {
        await approveAction(id);
        router.refresh();
      } finally {
        setApprovingId(null);
      }
    });
  }

  function handleRejectOpen(row: ApprovalRow) {
    setRejectingRow(row);
  }

  function handleRejectClose() {
    setRejectingRow(null);
  }

  async function handleRejectConfirm(reason: string) {
    if (!rejectingRow) return;
    setRejectPending(true);
    try {
      await rejectAction(rejectingRow.id, reason || 'رُفض من قِبل المشرف');
      setRejectingRow(null);
      router.refresh();
    } finally {
      setRejectPending(false);
    }
  }

  return (
    <RoleGuard allow={['admin']}>
      <PageHeader
        title={
          locale === 'ar'
            ? 'موافقات الذكاء الاصطناعي — AI Approvals'
            : 'AI Approvals — موافقات الذكاء الاصطناعي'
        }
        actions={
          pendingCount > 0 ? (
            <span className="rounded-full bg-red-600 px-3 py-1 text-[13px] font-bold text-white">
              {pendingCount}
            </span>
          ) : undefined
        }
      />

      {/* Alert banner */}
      {pendingCount > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-osa border border-amber-300 bg-amber-50 px-4 py-3 text-[13.5px] font-semibold text-amber-800">
          <span className="text-[18px]">⚠️</span>
          <span>
            {pendingCount} {locale === 'ar' ? 'إجراءات تنتظر موافقتك' : `action${pendingCount !== 1 ? 's' : ''} awaiting your approval`}
          </span>
        </div>
      )}

      {/* ── Pending actions ──────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-[15px] font-bold text-osa-ink">
          {locale === 'ar' ? 'الإجراءات المعلّقة' : 'Pending Actions'}
          {pendingCount > 0 && (
            <span className="ms-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[12px] font-semibold text-red-700">
              {pendingCount}
            </span>
          )}
        </h2>

        {data.pending.length === 0 ? (
          <div className={`${CARD} p-8 text-center`}>
            <p className="text-[15px] text-osa-faint">
              {locale === 'ar' ? 'لا توجد إجراءات معلّقة ✓' : 'No pending actions ✓'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.pending.map((row) => (
              <ActionCard
                key={row.id}
                row={row}
                onApprove={handleApprove}
                onReject={handleRejectOpen}
                approving={(approvingId === row.id && isPending)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Recently resolved ────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-[15px] font-bold text-osa-ink">
          {locale === 'ar' ? 'الإجراءات المُحسومة مؤخراً' : 'Recently Resolved'}
        </h2>

        {data.recentResolved.length === 0 ? (
          <div className={`${CARD} p-6 text-center`}>
            <p className="text-[13px] text-osa-faint">
              {locale === 'ar' ? 'لا يوجد سجل بعد' : 'No history yet'}
            </p>
          </div>
        ) : (
          <div className={`${CARD} overflow-hidden`}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {[
                    locale === 'ar' ? 'الوكيل' : 'Agent',
                    locale === 'ar' ? 'الأداة' : 'Tool',
                    locale === 'ar' ? 'المخاطرة' : 'Risk',
                    locale === 'ar' ? 'الحالة' : 'Status',
                    locale === 'ar' ? 'التاريخ' : 'Date',
                  ].map((h) => (
                    <th
                      key={h}
                      className="border-b border-osa-border px-4 pb-2.5 pt-3.5 text-start text-[11.5px] font-medium text-osa-faint"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentResolved.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-osa-surface-2">
                    <td className="border-b border-osa-border px-4 py-2.5">
                      <span className="rounded-full bg-osa-brand-dim px-2 py-0.5 text-[11.5px] font-semibold text-osa-brand">
                        {AGENT_LABELS[row.agent] ?? row.agent}
                      </span>
                    </td>
                    <td className="border-b border-osa-border px-4 py-2.5 font-mono font-semibold text-osa-ink">
                      {row.tool}
                    </td>
                    <td className="border-b border-osa-border px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${RISK_COLORS[row.riskLabel] ?? ''}`}
                      >
                        {row.riskLabel}
                      </span>
                    </td>
                    <td className="border-b border-osa-border px-4 py-2.5">
                      {/* status comes from raw data but we only show resolved rows */}
                      <span className="text-osa-muted">مُحسوم</span>
                    </td>
                    <td className="border-b border-osa-border px-4 py-2.5 text-osa-faint">
                      <span className="num text-[12px]">{formatDate(row.createdAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Live badge ───────────────────────────────────────── */}
      {!data.live && (
        <p className="mt-4 text-center text-[11.5px] text-osa-faint">
          {locale === 'ar'
            ? 'عرض بيانات تجريبية — الاتصال بقاعدة البيانات غير متوفر'
            : 'Showing sample data — database connection unavailable'}
        </p>
      )}

      {/* ── Reject modal ─────────────────────────────────────── */}
      {rejectingRow && (
        <RejectModal
          row={rejectingRow}
          onClose={handleRejectClose}
          onConfirm={handleRejectConfirm}
          pending={rejectPending}
        />
      )}
    </RoleGuard>
  );
}
