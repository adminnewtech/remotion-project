'use client';

import { useState, useTransition } from 'react';
import type { TaskStatus } from '@elite/types';
import { StatusPill } from '@elite/ui/web';
import type { StatusTone } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { PageHeader } from '@/components/admin/ui';
import type { DispatchData, DispatchTask } from '@/lib/admin-dispatch';
import { reassignTask, autoAssignTasks } from '@/app/[locale]/admin/dispatch/actions';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface p-3 shadow-osa';

/** Map a task status to an OSALPHA StatusPill tone. */
function statusTone(s: TaskStatus): StatusTone {
  switch (s) {
    case 'unassigned':
      return 'late';
    case 'assigned':
    case 'accepted':
      return 'new';
    case 'en_route':
    case 'arrived':
    case 'in_progress':
      return 'prep';
    case 'completed':
      return 'done';
    default:
      return 'neutral';
  }
}

/** Dispatch board: unassigned vs in-progress, with assign/reassign per task. */
export function DispatchBoard({ data }: { data: DispatchData }) {
  const { t, locale } = useT();
  const ar = locale === 'ar';
  const [tasks, setTasks] = useState<DispatchTask[]>(data.tasks);
  const [pending, startTransition] = useTransition();

  const drivers = data.staff.filter((s) => s.role === 'driver');
  const technicians = data.staff.filter((s) => s.role === 'technician');
  const fieldStaff = [...drivers, ...technicians];

  function assign(taskId: string, assigneeId: string) {
    const next = assigneeId || null;
    setTasks((prev) =>
      prev.map((tk) =>
        tk.id === taskId
          ? { ...tk, assignee_id: next, status: (next ? 'assigned' : 'unassigned') as TaskStatus }
          : tk,
      ),
    );
    startTransition(async () => {
      await reassignTask(taskId, next);
    });
  }

  function autoAssign() {
    // Optimistic: round-robin unassigned to the matching pool locally.
    setTasks((prev) => {
      const dq = [...drivers];
      const tq = [...technicians];
      let di = 0;
      let ti = 0;
      return prev.map((tk) => {
        if (tk.status !== 'unassigned') return tk;
        const pool = tk.type === 'delivery' ? dq : tq;
        if (!pool.length) return tk;
        const owner = tk.type === 'delivery' ? pool[di++ % pool.length]! : pool[ti++ % pool.length]!;
        return { ...tk, assignee_id: owner.id, status: 'assigned' as TaskStatus };
      });
    });
    startTransition(async () => {
      await autoAssignTasks();
    });
  }

  const columns: { key: string; title: string; filter: (s: TaskStatus) => boolean }[] = [
    { key: 'unassigned', title: t('taskStatus.unassigned'), filter: (s) => s === 'unassigned' },
    { key: 'assigned', title: t('taskStatus.assigned'), filter: (s) => s === 'assigned' || s === 'accepted' },
    { key: 'active', title: t('taskStatus.in_progress'), filter: (s) => s === 'en_route' || s === 'arrived' || s === 'in_progress' },
  ];

  return (
    <div>
      <PageHeader
        title={t('admin.dispatch')}
        subtitle={t('nav.deliveries')}
        actions={
          <button
            type="button"
            onClick={autoAssign}
            disabled={pending}
            className="rounded-full border border-osa-brand-border bg-osa-brand-dim px-[14px] py-[7px] text-[12.5px] font-semibold text-osa-brand transition-transform active:scale-[.97] disabled:opacity-60"
          >
            {t('admin.autoAssign')}
          </button>
        }
      />

      <div className="grid gap-[14px] lg:grid-cols-3">
        {columns.map((col) => {
          const items = tasks.filter((tk) => col.filter(tk.status));
          return (
            <div key={col.key} className="rounded-osa border border-osa-border bg-osa-surface-2 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-[14px] font-bold text-osa-ink">{col.title}</h2>
                <span className="num rounded-full bg-osa-surface px-2 py-0.5 text-[11.5px] font-semibold text-osa-muted">
                  {items.length}
                </span>
              </div>
              <div className="space-y-3">
                {items.map((tk) => {
                  const pool = tk.type === 'delivery' ? drivers : technicians;
                  const isDelivery = tk.type === 'delivery';
                  return (
                    <div key={tk.id} className={CARD}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="num text-[12px] text-osa-muted">{tk.orderNumber}</span>
                        <span
                          className={
                            'inline-block whitespace-nowrap rounded-full px-3 py-[3px] text-[11.5px] font-semibold ' +
                            (isDelivery ? 'bg-osa-blue-dim text-osa-blue' : 'bg-osa-aqua-dim text-osa-aqua')
                          }
                        >
                          {isDelivery ? t('nav.deliveries') : t('installation.tracking')}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[14px] font-semibold text-osa-ink">{tk.customer}</p>
                      <p className="text-[12px] text-osa-faint">
                        {(tk.area ?? '—')} · {tk.scheduled_for ?? '—'}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <StatusPill tone={statusTone(tk.status)}>{t(`taskStatus.${tk.status}`)}</StatusPill>
                      </div>
                      <select
                        className="mt-2.5 w-full rounded-osa-sm border border-osa-border bg-osa-surface px-2.5 py-2 text-[13px] text-osa-ink outline-none transition-colors focus:border-osa-brand-border"
                        value={tk.assignee_id ?? ''}
                        onChange={(e) => assign(tk.id, e.target.value)}
                        aria-label={t('admin.reassign')}
                      >
                        <option value="">{t('taskStatus.unassigned')}</option>
                        {pool.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name} — {s.zone}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <p className="px-1 py-6 text-center text-[12px] text-osa-faint">{t('common.none')}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Available staff ──────────────────────────────────── */}
      <section className="mt-[14px] rounded-osa border border-osa-border bg-osa-surface p-[18px_20px] shadow-osa">
        <h2 className="mb-[13px] text-[14.5px] font-bold text-osa-ink">
          {ar ? 'الطاقم المتاح' : 'Available staff'}
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {fieldStaff.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2.5 rounded-full border border-osa-border bg-osa-surface-2 py-[5px] pe-[13px] ps-[5px]"
            >
              <span className="grid h-[30px] w-[30px] flex-shrink-0 place-items-center rounded-full bg-osa-brand-dim text-[12px] font-semibold text-osa-brand">
                {(s.full_name ?? '?').slice(0, 1)}
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold text-osa-ink">{s.full_name}</div>
                <div className="text-[11px] text-osa-faint">
                  {t(`roles.${s.role}`)} · {s.zone}
                </div>
              </div>
              <span className="num ms-1 text-[11.5px] font-semibold text-osa-muted">{s.utilization}%</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
