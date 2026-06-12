'use client';

import { useEffect, useRef, useState } from 'react';
import { ai } from '@elite/core';
import type { AiConversation } from '@elite/core';
import { Button } from '@elite/ui/web';
import { useSupabase } from '@/components/providers';
import { useT } from '@/lib/use-t';
import { SimpleMarkdown } from './markdown';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Ops copilot chat box. Loads the latest 20 conversation rows (RLS scopes to
 * the caller / ops), then streams Q&A through the `ai-copilot` Edge Function via
 * `ai.askCopilot`. Renders answers with the lightweight markdown renderer.
 */
export function CopilotWidget() {
  const { locale } = useT();
  const supabase = useSupabase();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const ar = locale === 'ar';

  // Load conversation history once.
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    ai.listConversation(supabase, 20)
      .then((rows: AiConversation[]) => {
        if (!active) return;
        setTurns(
          rows
            .filter((r) => r.role === 'user' || r.role === 'assistant')
            .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content })),
        );
      })
      .catch(() => {
        /* empty history is fine */
      });
    return () => {
      active = false;
    };
  }, [supabase]);

  // Auto-scroll to the newest turn.
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [turns, busy]);

  async function send() {
    const message = input.trim();
    if (!message || busy || !supabase) return;
    setError(null);
    setInput('');
    setTurns((prev) => [...prev, { role: 'user', content: message }]);
    setBusy(true);
    try {
      const res = await ai.askCopilot(supabase, message);
      setTurns((prev) => [...prev, { role: 'assistant', content: res.answer }]);
    } catch {
      setError(ar ? 'تعذّر الحصول على رد. حاول مجدداً.' : 'Could not get a reply. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const suggestions = ar
    ? ['كم مبيعات اليوم؟', 'وش المخزون اللي خلص؟', 'كم مهمة متأخرة؟']
    : ["Today's sales?", 'What is low on stock?', 'How many late tasks?'];

  return (
    <div className="flex h-full flex-col rounded-osa border border-osa-border bg-osa-surface shadow-osa">
      <div className="flex items-center gap-2 border-b border-osa-border px-5 py-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-osa-sm bg-gradient-to-br from-osa-brand-strong to-osa-brand text-[13px] font-black text-white">
          AI
        </span>
        <div>
          <p className="text-[13.5px] font-bold leading-none text-osa-ink">
            {ar ? 'مساعد العمليات' : 'Ops Copilot'}
          </p>
          <p className="text-[11px] text-osa-muted">
            {ar ? 'يسأل عن بياناتك المباشرة' : 'Ask about your live data'}
          </p>
        </div>
      </div>

      <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" style={{ maxHeight: 360 }}>
        {turns.length === 0 && (
          <div className="space-y-2 py-6 text-center">
            <p className="text-[13px] text-osa-muted">
              {ar ? 'اسأل المساعد عن حالة عملك اليوم.' : 'Ask the copilot about your business today.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="rounded-full border border-osa-border px-3 py-1 text-[11.5px] text-osa-muted transition-colors hover:border-osa-brand-border hover:text-osa-brand"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className={turn.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] rounded-osa px-3 py-2 ${
                turn.role === 'user'
                  ? 'bg-osa-brand text-white'
                  : 'border border-osa-border bg-osa-surface-2 text-osa-ink'
              }`}
            >
              {turn.role === 'user' ? (
                <p className="whitespace-pre-wrap text-[13px]">{turn.content}</p>
              ) : (
                <SimpleMarkdown text={turn.content} />
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="rounded-osa border border-osa-border bg-osa-surface-2 px-3 py-2 text-[13px] text-osa-muted">
              {ar ? '...يكتب' : 'thinking…'}
            </div>
          </div>
        )}
      </div>

      {error && <p className="px-4 text-[11.5px] text-osa-rose">{error}</p>}

      <div className="flex items-center gap-2 border-t border-osa-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={ar ? 'اكتب سؤالك…' : 'Type your question…'}
          className="flex-1 rounded-osa-sm border border-osa-border bg-osa-surface px-3 py-2 text-[13px] text-osa-ink outline-none transition-colors placeholder:text-osa-faint focus:border-osa-brand-border"
        />
        <Button size="sm" onClick={() => void send()} disabled={busy || !input.trim()}>
          {ar ? 'إرسال' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
