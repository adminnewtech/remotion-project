'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Ticket,
  TicketChannel,
  TicketKind,
  TicketMessage,
  TicketStatus,
} from '@elite/types';
import { support } from '@elite/core';
import { StatusPill, Button } from '@elite/ui/web';
import type { StatusTone } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { fmtDate } from '@/lib/format';
import { getBrowserClient } from '@/lib/supabase/client';

// ── Channel presentation (Arabic-first labels, locale-ternary fallback) ──────
const CHANNELS: TicketChannel[] = ['in_app', 'whatsapp', 'instagram', 'email', 'chatwoot'];
const STATUSES: TicketStatus[] = ['open', 'pending', 'resolved', 'closed'];
const KINDS: TicketKind[] = ['general', 'warranty', 'complaint', 'return'];

function channelLabel(c: TicketChannel, locale: string): string {
  const ar: Record<TicketChannel, string> = {
    in_app: 'داخل التطبيق',
    whatsapp: 'واتساب',
    instagram: 'إنستغرام',
    email: 'البريد',
    chatwoot: 'Chatwoot',
  };
  const en: Record<TicketChannel, string> = {
    in_app: 'In-app',
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    email: 'Email',
    chatwoot: 'Chatwoot',
  };
  return locale === 'ar' ? ar[c] : en[c];
}

/** OSALPHA token classes for the channel pill. */
function channelPill(c: TicketChannel): string {
  switch (c) {
    case 'whatsapp':
      return 'bg-osa-green-dim text-osa-green';
    case 'instagram':
      return 'bg-osa-rose-dim text-osa-rose';
    case 'email':
      return 'bg-osa-blue-dim text-osa-blue';
    case 'chatwoot':
      return 'bg-osa-brand-dim text-osa-brand';
    default:
      return 'bg-osa-surface-2 text-osa-muted';
  }
}

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

function channelIcon(c: TicketChannel): string {
  switch (c) {
    case 'whatsapp':
      return '🟢';
    case 'instagram':
      return '📸';
    case 'email':
      return '✉️';
    case 'chatwoot':
      return '💬';
    default:
      return '📱';
  }
}

function ChannelBadge({ channel, locale }: { channel: TicketChannel; locale: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${channelPill(channel)}`}
    >
      <span aria-hidden>{channelIcon(channel)}</span>
      {channelLabel(channel, locale)}
    </span>
  );
}

interface Props {
  tickets: Ticket[];
  initialMessages: Record<string, TicketMessage[]>;
}

/**
 * Ops omnichannel inbox: filterable ticket list with channel badges, a
 * direction-aware conversation view, a customer context card, and a reply box
 * that routes by channel (in-app insert vs WhatsApp send). Realtime via
 * @elite/core streamTicketMessages.
 */
export function AdminSupportQueue({ tickets, initialMessages }: Props) {
  const { t, locale } = useT();
  const client = getBrowserClient();

  const [channelFilter, setChannelFilter] = useState<TicketChannel | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [kindFilter, setKindFilter] = useState<TicketKind | 'all'>('all');

  const filtered = useMemo(
    () =>
      tickets.filter(
        (tk) =>
          (channelFilter === 'all' || tk.channel === channelFilter) &&
          (statusFilter === 'all' || tk.status === statusFilter) &&
          (kindFilter === 'all' || tk.kind === kindFilter),
      ),
    [tickets, channelFilter, statusFilter, kindFilter],
  );

  const [active, setActive] = useState<Ticket | null>(filtered[0] ?? tickets[0] ?? null);
  const [messages, setMessages] = useState<Record<string, TicketMessage[]>>(initialMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<TicketStatus | null>(active?.status ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the active selection valid as filters change.
  useEffect(() => {
    if (active && filtered.some((tk) => tk.id === active.id)) return;
    setActive(filtered[0] ?? null);
  }, [filtered, active]);

  useEffect(() => {
    setStatus(active?.status ?? null);
  }, [active]);

  const activeMessages = active ? messages[active.id] ?? [] : [];

  // Auto-scroll the thread to the newest message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeMessages.length, active?.id]);

  // Realtime: subscribe to new messages on the active ticket.
  useEffect(() => {
    if (!client || !active) return;
    const channel = support.streamTicketMessages(client, active.id, (msg) => {
      setMessages((prev) => {
        const list = prev[active.id] ?? [];
        if (list.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [active.id]: [...list, msg] };
      });
    });
    return () => {
      client.removeChannel(channel);
    };
  }, [client, active]);

  async function handleSend() {
    if (!active || !draft.trim()) return;
    const text = draft.trim();
    setSending(true);
    try {
      if (client) {
        const sessionRes = await client.auth.getUser();
        const senderId = sessionRes.data.user?.id;
        const res = await support.replyToTicket(client, active.id, text, senderId);
        if (res.message) {
          setMessages((prev) => {
            const list = prev[active.id] ?? [];
            if (list.some((m) => m.id === res.message!.id)) return prev;
            return { ...prev, [active.id]: [...list, res.message!] };
          });
        }
      } else {
        // Offline / sample mode: optimistic local echo.
        const echo: TicketMessage = {
          id: `local-${Date.now()}`,
          ticket_id: active.id,
          sender_id: null,
          body: text,
          attachments: [],
          direction: 'outbound',
          external_id: null,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => ({ ...prev, [active.id]: [...(prev[active.id] ?? []), echo] }));
      }
      setDraft('');
    } catch (err) {
      console.error('reply failed', err);
      // eslint-disable-next-line no-alert
      alert(locale === 'ar' ? 'تعذّر إرسال الرسالة.' : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  async function handleStatus(next: TicketStatus) {
    if (!active) return;
    setStatus(next);
    if (client) {
      try {
        await support.setTicketStatus(client, active.id, next);
      } catch (err) {
        console.error('status update failed', err);
      }
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* ── Filters + Queue ──────────────────────────────────────────────── */}
      <div className="space-y-3 lg:col-span-4">
        <div className="flex flex-wrap gap-2">
          <FilterSelect
            label={locale === 'ar' ? 'القناة' : 'Channel'}
            value={channelFilter}
            onChange={(v) => setChannelFilter(v as TicketChannel | 'all')}
            options={[
              ['all', locale === 'ar' ? 'كل القنوات' : 'All channels'],
              ...CHANNELS.map((c) => [c, channelLabel(c, locale)] as [string, string]),
            ]}
          />
          <FilterSelect
            label={locale === 'ar' ? 'الحالة' : 'Status'}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as TicketStatus | 'all')}
            options={[
              ['all', locale === 'ar' ? 'كل الحالات' : 'All statuses'],
              ...STATUSES.map((s) => [s, t(`support.status.${s}`)] as [string, string]),
            ]}
          />
          <FilterSelect
            label={locale === 'ar' ? 'النوع' : 'Kind'}
            value={kindFilter}
            onChange={(v) => setKindFilter(v as TicketKind | 'all')}
            options={[
              ['all', locale === 'ar' ? 'كل الأنواع' : 'All kinds'],
              ...KINDS.map((k) => [k, t(`support.kind.${k}`)] as [string, string]),
            ]}
          />
        </div>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="rounded-osa border border-dashed border-osa-border-strong p-6 text-center text-[13px] text-osa-muted">
              {t('support.empty')}
            </p>
          ) : (
            filtered.map((tk) => (
              <button
                key={tk.id}
                onClick={() => setActive(tk)}
                className={`w-full rounded-osa border bg-osa-surface p-4 text-start shadow-osa transition-colors ${active?.id === tk.id ? 'border-osa-brand-border ring-1 ring-osa-brand-border' : 'border-osa-border hover:border-osa-brand-border'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] font-semibold text-osa-ink">{tk.subject}</span>
                  <StatusPill tone={statusTone(tk.status)}>{t(`support.status.${tk.status}`)}</StatusPill>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <ChannelBadge channel={tk.channel} locale={locale} />
                  <span className="num text-[11px] text-osa-faint">{fmtDate(tk.created_at, locale)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Conversation ─────────────────────────────────────────────────── */}
      <div className="lg:col-span-5">
        {active ? (
          <div className="flex h-[34rem] flex-col rounded-osa border border-osa-border bg-osa-surface shadow-osa">
            <div className="flex items-center justify-between gap-2 border-b border-osa-border p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-bold text-osa-ink">{active.subject}</p>
                  <ChannelBadge channel={active.channel} locale={locale} />
                </div>
                <p className="num mt-0.5 text-[11.5px] text-osa-faint">
                  {active.zoho_desk_id
                    ? t('support.ticketNumber', { number: active.zoho_desk_id })
                    : active.external_id
                      ? `#${active.external_id}`
                      : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {active.kind === 'warranty' && <StatusPill tone="brand">{t('support.warrantyClaim')}</StatusPill>}
                <select
                  value={status ?? active.status}
                  onChange={(e) => handleStatus(e.target.value as TicketStatus)}
                  className="rounded-osa-sm border border-osa-border bg-osa-surface px-2 py-1 text-[12px] text-osa-ink outline-none transition-colors focus:border-osa-brand-border"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`support.status.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {activeMessages.length === 0 ? (
                <p className="text-center text-[13px] text-osa-muted">{t('support.empty')}</p>
              ) : (
                activeMessages.map((m) => <Bubble key={m.id} message={m} />)
              )}
            </div>

            <div className="flex gap-2 border-t border-osa-border p-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={t('support.typeMessage')}
                className="flex-1 rounded-osa-sm border border-osa-border bg-osa-surface px-3 py-2 text-[13px] text-osa-ink outline-none transition-colors placeholder:text-osa-faint focus:border-osa-brand-border"
              />
              <Button onClick={() => void handleSend()} disabled={sending || !draft.trim()}>
                {t('support.send')}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-osa-muted">{t('support.empty')}</p>
        )}
      </div>

      {/* ── Customer context ─────────────────────────────────────────────── */}
      <div className="lg:col-span-3">
        {active ? (
          <CustomerCard ticket={active} locale={locale} t={t} />
        ) : null}
      </div>
    </div>
  );
}

/** Direction-aware chat bubble. Inbound start-aligned, outbound end-aligned (RTL-correct). */
function Bubble({ message }: { message: TicketMessage }) {
  const outbound = message.direction === 'outbound';
  return (
    <div
      className={
        outbound
          ? 'ms-auto max-w-[80%] rounded-osa rounded-se-sm bg-osa-brand p-3 text-[13px] text-white'
          : 'me-auto max-w-[80%] rounded-osa rounded-ss-sm bg-osa-surface-2 p-3 text-[13px] text-osa-ink'
      }
    >
      <p className="whitespace-pre-wrap break-words">{message.body}</p>
    </div>
  );
}

/** Customer context side card: name/phone, linked order(s), warranty hint. */
function CustomerCard({
  ticket,
  locale,
  t,
}: {
  ticket: Ticket;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="space-y-3 rounded-osa border border-osa-border bg-osa-surface p-4 shadow-osa">
      <h3 className="text-[14px] font-bold text-osa-ink">{locale === 'ar' ? 'بطاقة العميل' : 'Customer'}</h3>
      <dl className="space-y-2 text-[13px]">
        <Row label={locale === 'ar' ? 'القناة' : 'Channel'}>
          <ChannelBadge channel={ticket.channel} locale={locale} />
        </Row>
        {ticket.customer_phone && (
          <Row label={locale === 'ar' ? 'الهاتف' : 'Phone'}>
            <a className="num font-semibold text-osa-brand" href={`https://wa.me/${ticket.customer_phone}`}>
              {ticket.customer_phone}
            </a>
          </Row>
        )}
        <Row label={locale === 'ar' ? 'العميل' : 'Customer'}>
          <span className="text-osa-muted">
            {ticket.user_id
              ? ticket.user_id.slice(0, 8)
              : locale === 'ar'
                ? 'غير مرتبط بعد'
                : 'Not linked yet'}
          </span>
        </Row>
        <Row label={locale === 'ar' ? 'الطلب' : 'Order'}>
          {ticket.order_id ? (
            <a className="num font-semibold text-osa-brand" href={`/${locale}/admin/orders/${ticket.order_id}`}>
              {ticket.order_id.slice(0, 8)}
            </a>
          ) : (
            <span className="text-osa-muted">{locale === 'ar' ? 'لا يوجد' : 'None'}</span>
          )}
        </Row>
        <Row label={locale === 'ar' ? 'النوع' : 'Kind'}>
          <span className="text-osa-ink">{t(`support.kind.${ticket.kind}`)}</span>
        </Row>
        {ticket.kind === 'warranty' && (
          <Row label={locale === 'ar' ? 'الضمان' : 'Warranty'}>
            <StatusPill tone="brand">{t('support.warrantyClaim')}</StatusPill>
          </Row>
        )}
      </dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[11.5px] text-osa-muted">{label}</dt>
      <dd className="text-end">{children}</dd>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex flex-col gap-1 text-[11.5px]">
      <span className="text-osa-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-osa-sm border border-osa-border bg-osa-surface px-2 py-1.5 text-[13px] text-osa-ink outline-none transition-colors focus:border-osa-brand-border"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
