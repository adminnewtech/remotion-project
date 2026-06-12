import { getServerClient } from '@/lib/supabase/server';
import { AutomationView, type WorkflowRow, type RunRow } from '@/components/admin/automation/automation-view';

export const dynamic = 'force-dynamic';

const SAMPLE_WF: WorkflowRow[] = [
  { id: 'w1', name: 'ترحيب بعد الدفع (واتساب)', trigger_kind: 'order_status', action_kind: 'whatsapp_template', is_active: true, runs: 12 },
  { id: 'w2', name: 'مهمة متابعة للمهدّدين بالفقد', trigger_kind: 'customer_at_risk', action_kind: 'create_task', is_active: true, runs: 4 },
];

/** CRM automation engine — workflows + runs (migration 0026). */
export default async function AutomationPage() {
  const client = await getServerClient();
  let workflows = SAMPLE_WF;
  let runs: RunRow[] = [];
  let live = false;
  if (client) {
    try {
      const [{ data: wfs }, { data: rs }] = await Promise.all([
        client.from('automation_workflows').select('id, name, trigger_kind, action_kind, is_active').order('created_at'),
        client.from('automation_runs').select('id, workflow_id, subject_kind, subject_id, status, detail, created_at').order('created_at', { ascending: false }).limit(40),
      ]);
      if (wfs) {
        live = true;
        const counts = new Map<string, number>();
        for (const r of (rs ?? []) as { workflow_id: string }[]) counts.set(r.workflow_id, (counts.get(r.workflow_id) ?? 0) + 1);
        const nameById = new Map((wfs as { id: string; name: string }[]).map((w) => [w.id, w.name]));
        workflows = (wfs as Omit<WorkflowRow, 'runs'>[]).map((w) => ({ ...w, runs: counts.get(w.id) ?? 0 }));
        runs = ((rs ?? []) as { id: number; workflow_id: string; subject_kind: string; subject_id: string; status: string; detail: string | null; created_at: string }[])
          .map((r) => ({ id: r.id, workflow: nameById.get(r.workflow_id) ?? '—', subject: `${r.subject_kind}:${r.subject_id.slice(0, 8)}`, status: r.status, detail: r.detail, at: r.created_at }));
      }
    } catch { /* sample */ }
  }
  return <AutomationView workflows={workflows} runs={runs} live={live} />;
}
