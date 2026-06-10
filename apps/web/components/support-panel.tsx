'use client';

import { useState } from 'react';
import type { Ticket, TicketKind } from '@elite/types';
import { Button, Input, Select, StatusBadge, EmptyState, Modal } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { fmtDate } from '@/lib/format';

const KINDS: TicketKind[] = ['general', 'warranty', 'complaint', 'return'];

/** Customer support: ticket list + new-request modal (Zoho Desk backed). */
export function SupportPanel({ tickets }: { tickets: Ticket[] }) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TicketKind>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{t('support.myTickets')}</h2>
        <Button onClick={() => setOpen(true)}>{t('support.newTicket')}</Button>
      </div>

      {tickets.length === 0 ? (
        <EmptyState title={t('support.empty')} />
      ) : (
        <div className="space-y-3">
          {tickets.map((tk) => (
            <div key={tk.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div>
                <p className="text-sm font-semibold">{tk.subject}</p>
                <p className="text-xs text-muted">
                  {t(`support.kind.${tk.kind}`)} · {fmtDate(tk.created_at, locale)}
                  {tk.zoho_desk_id ? ` · ${t('support.ticketNumber', { number: tk.zoho_desk_id })}` : ''}
                </p>
              </div>
              <StatusBadge status={tk.status} label={t(`support.status.${tk.status}`)} />
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t('support.newTicket')}>
        <div className="space-y-4">
          <Select label={t('support.kind.general')} value={kind} onChange={(e) => setKind(e.target.value as TicketKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`support.kind.${k}`)}
              </option>
            ))}
          </Select>
          <Input label={t('support.subject')} value={subject} onChange={(e) => setSubject(e.target.value)} />
          <div>
            <label className="mb-1 block text-sm font-medium">{t('support.message')}</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder={t('support.typeMessage')}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => setOpen(false)} disabled={!subject.trim()}>
              {t('support.send')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
