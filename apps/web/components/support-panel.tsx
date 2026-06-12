'use client';

import { useState } from 'react';
import type { Ticket, TicketKind, TicketStatus } from '@elite/types';
import { Button, Input, Select, EmptyState, Modal, StatusPill } from '@elite/ui/web';
import type { StatusTone } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { fmtDate } from '@/lib/format';

const KINDS: TicketKind[] = ['general', 'warranty', 'complaint', 'return'];

/** Map a ticket status to an OSALPHA StatusPill tone. */
function statusTone(s: TicketStatus): StatusTone {
  switch (s) {
    case 'open':
      return 'new';
    case 'pending':
      return 'prep';
    case 'resolved':
      return 'done';
    case 'closed':
      return 'neutral';
    default:
      return 'neutral';
  }
}

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
        <h2 className="text-lg font-bold text-osa-ink">{t('support.myTickets')}</h2>
        <Button onClick={() => setOpen(true)}>{t('support.newTicket')}</Button>
      </div>

      {tickets.length === 0 ? (
        <EmptyState title={t('support.empty')} />
      ) : (
        <div className="space-y-3">
          {tickets.map((tk) => (
            <div
              key={tk.id}
              className="flex items-center justify-between gap-2 rounded-osa border border-osa-border bg-osa-surface p-4 shadow-osa"
            >
              <div>
                <p className="text-[13.5px] font-semibold text-osa-ink">{tk.subject}</p>
                <p className="text-[11.5px] text-osa-faint">
                  {t(`support.kind.${tk.kind}`)} · {fmtDate(tk.created_at, locale)}
                  {tk.zoho_desk_id ? ` · ${t('support.ticketNumber', { number: tk.zoho_desk_id })}` : ''}
                </p>
              </div>
              <StatusPill tone={statusTone(tk.status)}>{t(`support.status.${tk.status}`)}</StatusPill>
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
            <label className="mb-1 block text-sm font-medium text-osa-ink">{t('support.message')}</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder={t('support.typeMessage')}
              className="w-full rounded-osa-sm border border-osa-border bg-osa-surface px-3 py-2 text-[13px] text-osa-ink outline-none transition-colors placeholder:text-osa-faint focus:border-osa-brand-border"
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
