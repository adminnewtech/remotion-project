'use client';

import { useState } from 'react';
import type { TaskStatus } from '@elite/types';
import { StatusBadge, Badge, Button, Select } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { PageHeader } from '@/components/admin/ui';
import { dispatchTasks, staff } from '@/lib/admin-sample';

/** Dispatch board: unassigned vs in-progress, with assign/reassign per task. */
export default function DispatchBoard() {
  const { t, locale } = useT();
  const [tasks, setTasks] = useState(dispatchTasks);

  const drivers = staff.filter((s) => s.role === 'driver');
  const technicians = staff.filter((s) => s.role === 'technician');

  function assign(taskId: string, assigneeId: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, assignee_id: assigneeId || null, status: (assigneeId ? 'assigned' : 'unassigned') as TaskStatus }
          : t,
      ),
    );
  }

  const columns: { key: string; title: string; filter: (s: TaskStatus) => boolean }[] = [
    { key: 'unassigned', title: t('taskStatus.unassigned'), filter: (s) => s === 'unassigned' },
    { key: 'assigned', title: t('taskStatus.assigned'), filter: (s) => s === 'assigned' || s === 'accepted' },
    { key: 'active', title: t('taskStatus.in_progress'), filter: (s) => s === 'en_route' || s === 'arrived' || s === 'in_progress' },
  ];

  return (
    <div>
      <PageHeader title={t('admin.dispatch')} subtitle={t('nav.deliveries')} actions={<Button variant="outline">{t('admin.autoAssign')}</Button>} />

      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => {
          const items = tasks.filter((tk) => col.filter(tk.status));
          return (
            <div key={col.key} className="rounded-2xl border border-border bg-neutral-50 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-bold">{col.title}</h2>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.map((tk) => {
                  const pool = tk.type === 'delivery' ? drivers : technicians;
                  return (
                    <div key={tk.id} className="rounded-xl border border-border bg-surface p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs">{tk.orderNumber}</span>
                        <Badge variant={tk.type === 'delivery' ? 'info' : 'accent'}>
                          {tk.type === 'delivery' ? t('nav.deliveries') : t('installation.tracking')}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm font-semibold">{tk.customer}</p>
                      <p className="text-xs text-muted">
                        {tk.area} · {tk.scheduled_for}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <StatusBadge status={tk.status} label={t(`taskStatus.${tk.status}`)} />
                      </div>
                      <Select
                        className="mt-2 text-sm"
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
                      </Select>
                    </div>
                  );
                })}
                {items.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted">{t('common.none')}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
