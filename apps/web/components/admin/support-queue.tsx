'use client';

import { useState } from 'react';
import type { Ticket } from '@elite/types';
import { StatusBadge, Badge, Button } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { fmtDate } from '@/lib/format';

/** Ops support queue: select a ticket → threaded chat (Zoho Desk backed). */
export function AdminSupportQueue({ tickets }: { tickets: Ticket[] }) {
  const { t, locale } = useT();
  const [active, setActive] = useState<Ticket | null>(tickets[0] ?? null);
  const [draft, setDraft] = useState('');

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Queue */}
      <div className="space-y-2 lg:col-span-1">
        {tickets.map((tk) => (
          <button
            key={tk.id}
            onClick={() => setActive(tk)}
            className={`w-full rounded-2xl border bg-surface p-4 text-start shadow-sm transition ${active?.id === tk.id ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/40'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{tk.subject}</span>
              <StatusBadge status={tk.status} label={t(`support.status.${tk.status}`)} />
            </div>
            <p className="mt-1 text-xs text-muted">
              {t(`support.kind.${tk.kind}`)} · {fmtDate(tk.created_at, locale)}
            </p>
          </button>
        ))}
      </div>

      {/* Thread */}
      <div className="lg:col-span-2">
        {active ? (
          <div className="flex h-[28rem] flex-col rounded-2xl border border-border bg-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <p className="font-bold">{active.subject}</p>
                <p className="text-xs text-muted">
                  {active.zoho_desk_id ? t('support.ticketNumber', { number: active.zoho_desk_id }) : ''}
                </p>
              </div>
              <div className="flex gap-2">
                {active.kind === 'warranty' && <Badge variant="info">{t('support.warrantyClaim')}</Badge>}
                <Button size="sm" variant="outline">{t('support.status.resolved')}</Button>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div className="max-w-[80%] rounded-2xl rounded-ss-sm bg-neutral-100 p-3 text-sm">
                {locale === 'ar' ? 'مرحبًا، لدي مشكلة في المنتج.' : 'Hi, I have an issue with my product.'}
              </div>
              <div className="ms-auto max-w-[80%] rounded-2xl rounded-se-sm bg-primary p-3 text-sm text-white">
                {locale === 'ar' ? 'أهلًا بك، سنساعدك فورًا.' : 'Hello, we will help you right away.'}
              </div>
            </div>
            <div className="flex gap-2 border-t border-border p-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t('support.typeMessage')}
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <Button onClick={() => setDraft('')} disabled={!draft.trim()}>{t('support.send')}</Button>
            </div>
          </div>
        ) : (
          <p className="text-muted">{t('support.empty')}</p>
        )}
      </div>
    </div>
  );
}
