'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import type { InboxData, ThreadRow } from '@/lib/admin-inbox';
import { sendWhatsApp } from '@/app/[locale]/admin/inbox/actions';
import { fmtDate } from '@/lib/format';
import type { Locale } from '@elite/types';
import { useT } from '@/lib/use-t';

// ── Message bubble (outbound = ops sent, inbound = customer) ─────────────────
function Bubble({
  body,
  direction,
  createdAt,
  locale,
}: {
  body: string;
  direction: 'in' | 'out';
  createdAt: string;
  locale: Locale;
}) {
  const outbound = direction === 'out';
  return (
    <div
      className={
        outbound
          ? 'ms-auto max-w-[80%] rounded-osa rounded-se-sm bg-osa-brand p-3 text-[13px] text-white'
          : 'me-auto max-w-[80%] rounded-osa rounded-ss-sm bg-osa-surface-2 p-3 text-[13px] text-osa-ink'
      }
    >
      <p className="whitespace-pre-wrap break-words">{body}</p>
      <p className={`mt-1 text-[10px] ${outbound ? 'text-white/70' : 'text-osa-faint'}`}>
        {fmtDate(createdAt, locale)}
      </p>
    </div>
  );
}

// ── Thread list item ──────────────────────────────────────────────────────────
function ThreadItem({
  thread,
  active,
  onClick,
  locale,
}: {
  thread: ThreadRow;
  active: boolean;
  onClick: () => void;
  locale: Locale;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-osa border p-3 text-start transition-colors ${
        active
          ? 'border-osa-brand-border bg-osa-brand/5 ring-1 ring-osa-brand-border'
          : 'border-osa-border bg-osa-surface hover:border-osa-brand-border'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* 24h window indicator */}
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${thread.windowOpen ? 'bg-osa-green' : 'bg-osa-surface-2 border border-osa-border'}`}
            title={thread.windowOpen ? 'نافذة 24 ساعة مفتوحة' : 'النافذة مغلقة'}
          />
          <span className="truncate text-[13px] font-semibold text-osa-ink">
            {thread.customerName ?? thread.phone}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {thread.unreadCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-osa-brand px-1 text-[10px] font-bold text-white">
              {thread.unreadCount}
            </span>
          )}
          <span className="num text-[10px] text-osa-faint">{fmtDate(thread.lastAt, locale)}</span>
        </div>
      </div>
      <p className="mt-1 truncate text-[11.5px] text-osa-muted">{thread.lastMessage}</p>
      <p className="num mt-0.5 text-[10.5px] text-osa-faint">{thread.phone}</p>
    </button>
  );
}

// ── Template picker ───────────────────────────────────────────────────────────
function TemplatePicker({
  templates,
  onSelect,
  onClose,
}: {
  templates: InboxData['templates'];
  onSelect: (tpl: { name: string; body: string }) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-full mb-2 start-0 z-10 w-full rounded-osa border border-osa-border bg-osa-surface shadow-xl">
      <div className="flex items-center justify-between border-b border-osa-border px-3 py-2">
        <span className="text-[12px] font-bold text-osa-ink">اختر قالباً</span>
        <button onClick={onClose} className="text-[11px] text-osa-muted hover:text-osa-ink">
          ✕
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {templates.length === 0 ? (
          <p className="p-3 text-center text-[12px] text-osa-muted">لا توجد قوالب</p>
        ) : (
          templates.map((tpl) => (
            <button
              key={tpl.name}
              onClick={() => onSelect(tpl)}
              className="w-full border-b border-osa-border px-3 py-2.5 text-start transition-colors last:border-0 hover:bg-osa-surface-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-osa-ink">{tpl.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    tpl.category === 'marketing'
                      ? 'bg-osa-rose-dim text-osa-rose'
                      : 'bg-osa-blue-dim text-osa-blue'
                  }`}
                >
                  {tpl.category === 'marketing' ? 'تسويق' : 'خدمة'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-osa-muted line-clamp-2">{tpl.body}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Dummy message history for selected thread (optimistic) ────────────────────
interface LocalMessage {
  id: string;
  body: string;
  direction: 'in' | 'out';
  createdAt: string;
}

// ── Main inbox view ───────────────────────────────────────────────────────────
export function InboxView({ data }: { data: InboxData }) {
  const { locale } = useT();
  const [activeThread, setActiveThread] = useState<ThreadRow | null>(
    data.threads[0] ?? null,
  );
  const [messages, setMessages] = useState<Record<string, LocalMessage[]>>({});
  const [draft, setDraft] = useState('');
  const [templatePreview, setTemplatePreview] = useState<{
    name: string;
    body: string;
  } | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeThread?.phone, messages]);

  const threadMessages = activeThread ? messages[activeThread.phone] ?? [] : [];
  const canSendFreeText = activeThread?.windowOpen ?? false;

  function handleSelectTemplate(tpl: { name: string; body: string }) {
    setTemplatePreview(tpl);
    setDraft(tpl.body);
    setShowTemplatePicker(false);
  }

  function handleSend() {
    if (!activeThread) return;
    const text = draft.trim();
    if (!text) return;

    // Optimistic echo
    const echo: LocalMessage = {
      id: `local-${Date.now()}`,
      body: text,
      direction: 'out',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => ({
      ...prev,
      [activeThread.phone]: [...(prev[activeThread.phone] ?? []), echo],
    }));
    setDraft('');
    setTemplatePreview(null);

    startTransition(async () => {
      try {
        await sendWhatsApp({
          phone: activeThread.phone,
          body: templatePreview ? undefined : text,
          template: templatePreview?.name,
          ticket_id: activeThread.ticketId ?? undefined,
        });
      } catch (e) {
        console.error('send failed', e);
      }
    });
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] gap-0 overflow-hidden rounded-osa border border-osa-border bg-osa-surface shadow-osa" dir="rtl">
      {/* ── Thread list (right panel in RTL) ─────────────────────────────── */}
      <div className="flex w-72 shrink-0 flex-col border-s border-osa-border">
        <div className="flex items-center justify-between border-b border-osa-border px-3 py-3">
          <div>
            <h2 className="text-[13.5px] font-bold text-osa-ink">صندوق واتساب</h2>
            {data.totalUnread > 0 && (
              <p className="mt-0.5 text-[11px] text-osa-muted">
                {data.totalUnread} رسالة غير مقروءة
              </p>
            )}
          </div>
          {!data.live && (
            <span className="rounded-full bg-osa-gold-dim px-2 py-0.5 text-[10px] font-semibold text-osa-gold">
              تجريبي
            </span>
          )}
        </div>
        <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
          {data.threads.length === 0 ? (
            <p className="p-4 text-center text-[12px] text-osa-muted">لا توجد محادثات</p>
          ) : (
            data.threads.map((thread) => (
              <ThreadItem
                key={thread.phone}
                thread={thread}
                active={activeThread?.phone === thread.phone}
                onClick={() => setActiveThread(thread)}
                locale={locale}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Conversation panel (left in RTL) ─────────────────────────────── */}
      <div className="flex flex-1 flex-col">
        {activeThread ? (
          <>
            {/* Conversation header */}
            <div className="flex items-center justify-between gap-2 border-b border-osa-border px-4 py-3">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${activeThread.windowOpen ? 'bg-osa-green' : 'bg-osa-surface-2 border border-osa-border'}`}
                />
                <div>
                  <p className="text-[14px] font-bold text-osa-ink">
                    {activeThread.customerName ?? activeThread.phone}
                  </p>
                  <p className="num text-[11px] text-osa-faint">{activeThread.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!activeThread.windowOpen && (
                  <span className="rounded-full bg-osa-rose-dim px-2 py-0.5 text-[10.5px] font-semibold text-osa-rose">
                    النافذة مغلقة — قالب فقط
                  </span>
                )}
                <a
                  href="../inbox/templates"
                  className="text-[11px] text-osa-brand hover:underline"
                >
                  إدارة القوالب
                </a>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {threadMessages.length === 0 ? (
                <p className="text-center text-[12px] text-osa-muted">
                  لا توجد رسائل — ابدأ المحادثة
                </p>
              ) : (
                threadMessages.map((m) => (
                  <Bubble
                    key={m.id}
                    body={m.body}
                    direction={m.direction}
                    createdAt={m.createdAt}
                    locale={locale}
                  />
                ))
              )}
            </div>

            {/* Composer */}
            <div className="relative border-t border-osa-border p-3">
              {showTemplatePicker && (
                <TemplatePicker
                  templates={data.templates}
                  onSelect={handleSelectTemplate}
                  onClose={() => setShowTemplatePicker(false)}
                />
              )}
              {templatePreview && (
                <div className="mb-2 flex items-center gap-2 rounded-osa bg-osa-blue-dim px-3 py-1.5">
                  <span className="text-[11px] font-semibold text-osa-blue">
                    قالب: {templatePreview.name}
                  </span>
                  <button
                    onClick={() => {
                      setTemplatePreview(null);
                      setDraft('');
                    }}
                    className="ms-auto text-[10px] text-osa-muted hover:text-osa-ink"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTemplatePicker((v) => !v)}
                  className="shrink-0 rounded-osa-sm border border-osa-border px-3 py-2 text-[12px] text-osa-muted transition-colors hover:border-osa-brand-border hover:text-osa-brand"
                  title="اختر قالباً"
                >
                  📋
                </button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={!canSendFreeText && !templatePreview}
                  placeholder={
                    canSendFreeText
                      ? 'اكتب رسالتك...'
                      : templatePreview
                        ? templatePreview.body
                        : 'النافذة مغلقة — اختر قالباً أولاً'
                  }
                  className="flex-1 rounded-osa-sm border border-osa-border bg-osa-surface px-3 py-2 text-[13px] text-osa-ink outline-none transition-colors placeholder:text-osa-faint focus:border-osa-brand-border disabled:cursor-not-allowed disabled:bg-osa-surface-2"
                />
                <button
                  onClick={handleSend}
                  disabled={isPending || !draft.trim()}
                  className="rounded-osa-sm bg-osa-brand px-4 py-2 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
                >
                  {isPending ? '...' : 'إرسال'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[13px] text-osa-muted">اختر محادثة من القائمة</p>
          </div>
        )}
      </div>
    </div>
  );
}
