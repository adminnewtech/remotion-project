'use client';

import { useState, useTransition } from 'react';
import { PageHeader, KpiCard } from '@/components/admin/ui';
import { useT } from '@/lib/use-t';
import { setWorkflowActive, runAutomations } from '@/app/[locale]/admin/automation/actions';

export interface WorkflowRow {
  id: string;
  name: string;
  trigger_kind: string;
  action_kind: string;
  is_active: boolean;
  runs: number;
}
export interface RunRow {
  id: number;
  workflow: string;
  subject: string;
  status: string;
  detail: string | null;
  at: string;
}

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';
const TRIGGER_AR: Record<string, string> = { order_status: 'تغيّر حالة طلب', customer_at_risk: 'عميل مهدد بالفقد' };
const ACTION_AR: Record<string, string> = { whatsapp_template: 'رسالة واتساب', create_task: 'إنشاء مهمة' };

/** CRM automation: workflows (toggle), run-now, and the runs log. */
export function AutomationView({ workflows, runs, live }: { workflows: WorkflowRow[]; runs: RunRow[]; live: boolean }) {
  const { locale } = useT();
  const ar = locale === 'ar';
  const [items, setItems] = useState(workflows);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(null), 3000); }

  function toggle(w: WorkflowRow) {
    setItems((p) => p.map((x) => (x.id === w.id ? { ...x, is_active: !x.is_active } : x)));
    startTransition(async () => { await setWorkflowActive(w.id, !w.is_active); });
  }
  function runNow() {
    startTransition(async () => {
      const res = await runAutomations();
      flash(res.ok
        ? (ar ? `تم التشغيل — نُفِّذ ${res.fired} · مكرر ${res.skipped} · أخطاء ${res.errors}` : `Ran — fired ${res.fired}, dup ${res.skipped}, errors ${res.errors}`)
        : `${ar ? 'فشل' : 'Failed'}: ${res.error}`);
    });
  }

  return (
    <>
      <PageHeader
        title={ar ? 'الأتمتة' : 'Automation'}
        subtitle={ar ? 'محرّك سير عمل CRM — مشغّل → شرط → إجراء' : 'CRM workflows — trigger → condition → action'}
        actions={
          <button type="button" onClick={runNow} disabled={pending}
            className="rounded-full bg-osa-brand px-5 py-[9px] text-[13.5px] font-semibold text-white shadow-[0_4px_12px_rgba(184,134,11,.25)] active:scale-[.97] disabled:opacity-50">
            ▶ {ar ? 'تشغيل الآن' : 'Run now'}
          </button>
        }
      />
      <div className="grid grid-cols-3 gap-[14px]">
        <KpiCard label={ar ? 'سير العمل' : 'Workflows'} value={String(items.length)} />
        <KpiCard label={ar ? 'الفعّالة' : 'Active'} value={String(items.filter((w) => w.is_active).length)} />
        <KpiCard label={ar ? 'تنفيذات مسجلة' : 'Runs logged'} value={String(runs.length)} />
      </div>
      {msg && <div className="mt-3 rounded-osa-sm bg-osa-green-dim px-3 py-2 text-[12.5px] font-semibold text-osa-green">{msg}</div>}
      {!live && <p className="mt-2 text-[11.5px] text-osa-faint">(عينة)</p>}

      <div className={`${CARD} mt-[14px] overflow-hidden`}>
        <h2 className="border-b border-osa-border p-3 text-[14.5px] font-bold text-osa-ink">{ar ? 'سير العمل' : 'Workflows'}</h2>
        <table className="w-full border-collapse text-[13px]">
          <thead><tr>{[ar ? 'الاسم' : 'Name', ar ? 'المشغّل' : 'Trigger', ar ? 'الإجراء' : 'Action', ar ? 'تنفيذات' : 'Runs', ''].map((h, i) => <th key={i} className="border-b border-osa-border px-3 pb-2 pt-3 text-start text-[11.5px] font-medium text-osa-faint">{h}</th>)}</tr></thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id} className="hover:bg-osa-surface-2">
                <td className="border-b border-osa-border px-3 py-2.5 font-semibold text-osa-ink">{w.name}</td>
                <td className="border-b border-osa-border px-3 py-2.5"><span className="rounded-full bg-osa-blue-dim px-2.5 py-[3px] text-[11px] font-semibold text-osa-blue">{TRIGGER_AR[w.trigger_kind] ?? w.trigger_kind}</span></td>
                <td className="border-b border-osa-border px-3 py-2.5"><span className="rounded-full bg-osa-green-dim px-2.5 py-[3px] text-[11px] font-semibold text-osa-green">{ACTION_AR[w.action_kind] ?? w.action_kind}</span></td>
                <td className="border-b border-osa-border px-3 py-2.5"><span className="num text-osa-muted">{w.runs}</span></td>
                <td className="border-b border-osa-border px-3 py-2.5 text-end">
                  <button type="button" onClick={() => toggle(w)} disabled={pending}
                    className={'rounded-full px-3 py-1 text-[11.5px] font-bold ' + (w.is_active ? 'bg-osa-green-dim text-osa-green' : 'bg-osa-surface-2 text-osa-faint')}>
                    {w.is_active ? (ar ? 'فعّال' : 'On') : (ar ? 'موقوف' : 'Off')}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-[12.5px] text-osa-faint">—</td></tr>}
          </tbody>
        </table>
      </div>

      <div className={`${CARD} mt-[14px] overflow-hidden`}>
        <h2 className="border-b border-osa-border p-3 text-[14.5px] font-bold text-osa-ink">{ar ? 'آخر التنفيذات' : 'Recent runs'}</h2>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="hover:bg-osa-surface-2">
                <td className="border-b border-osa-border px-3 py-2 text-[12.5px] text-osa-ink">{r.workflow}</td>
                <td className="border-b border-osa-border px-3 py-2"><span className="num text-[11.5px] text-osa-faint">{r.subject}</span></td>
                <td className="border-b border-osa-border px-3 py-2"><span className={'rounded-full px-2 py-[2px] text-[10.5px] font-bold ' + (r.status === 'ok' ? 'bg-osa-green-dim text-osa-green' : 'bg-osa-rose-dim text-osa-rose')}>{r.status}</span> <span className="text-[11px] text-osa-faint">{r.detail ?? ''}</span></td>
                <td className="border-b border-osa-border px-3 py-2 text-end"><span className="num text-[11px] text-osa-faint">{r.at.slice(5, 16).replace('T', ' ')}</span></td>
              </tr>
            ))}
            {runs.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-[12.5px] text-osa-faint">{ar ? 'لا تنفيذات بعد — اضغط «تشغيل الآن»' : 'No runs yet — press Run now'}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
