'use client';

import { useState, useTransition } from 'react';
import { addCustomerNote, setTaskDone } from '@/app/[locale]/admin/customers/[id]/actions';
import type { CustomerNote } from '@/lib/admin-customer';

const FIELD = 'rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border';

/** CRM notes & tasks on the 360 profile (Zoho-grade, native). */
export function NotesPanel({ customerId, initial, ar }: { customerId: string; initial: CustomerNote[]; ar: boolean }) {
  const [items, setItems] = useState<CustomerNote[]>(initial);
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<'note' | 'task'>('note');
  const [due, setDue] = useState('');
  const [pending, startTransition] = useTransition();

  function add() {
    const text = body.trim();
    if (!text) return;
    setBody('');
    startTransition(async () => {
      const res = await addCustomerNote(customerId, text, kind, kind === 'task' ? due || null : null);
      if (res.ok) {
        setItems((p) => [
          { id: res.id ?? `tmp-${Date.now()}`, kind, body: text, due_at: kind === 'task' ? due || null : null, done: false, created_at: new Date().toISOString() },
          ...p,
        ]);
      }
    });
  }
  function toggle(n: CustomerNote) {
    setItems((p) => p.map((x) => (x.id === n.id ? { ...x, done: !x.done } : x)));
    startTransition(async () => {
      await setTaskDone(n.id, !n.done);
    });
  }

  return (
    <div className="rounded-osa border border-osa-border bg-osa-surface p-5 shadow-osa">
      <h2 className="mb-3 text-[14.5px] font-bold text-osa-ink">{ar ? 'ملاحظات ومهام' : 'Notes & tasks'}</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as 'note' | 'task')} className={FIELD} aria-label="kind">
          <option value="note">{ar ? 'ملاحظة' : 'Note'}</option>
          <option value="task">{ar ? 'مهمة' : 'Task'}</option>
        </select>
        {kind === 'task' && <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={FIELD} aria-label="due" />}
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={ar ? 'اكتب ملاحظة أو مهمة…' : 'Write a note or task…'}
          className={`${FIELD} min-w-[220px] flex-1`}
        />
        <button type="button" onClick={add} disabled={pending || !body.trim()}
          className="rounded-full bg-osa-brand px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50">
          + {ar ? 'إضافة' : 'Add'}
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className="flex items-center gap-2.5 rounded-osa-sm bg-osa-surface-2 px-3 py-2">
            {n.kind === 'task' && (
              <input type="checkbox" checked={n.done} onChange={() => toggle(n)} aria-label="done" />
            )}
            <div className="min-w-0 flex-1">
              <p className={'text-[12.5px] ' + (n.done ? 'text-osa-faint line-through' : 'text-osa-ink')}>{n.body}</p>
              <p className="num text-[10.5px] text-osa-faint">
                {n.kind === 'task' ? (ar ? 'مهمة' : 'task') : (ar ? 'ملاحظة' : 'note')}
                {n.due_at ? ` · ${ar ? 'استحقاق' : 'due'} ${n.due_at}` : ''} · {n.created_at.slice(0, 10)}
              </p>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="py-3 text-center text-[12px] text-osa-faint">{ar ? 'لا ملاحظات بعد' : 'No notes yet'}</li>}
      </ul>
    </div>
  );
}
