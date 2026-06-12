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
  const { t, locale } = useT();
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
    <div className="flex h-full flex-col rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-sm font-black text-white">
          AI
        </span>
        <div>
          <p className="text-sm font-bold leading-none">
            {ar ? 'مساعد العمليات' : 'Ops Copilot'}
          </p>
          <p className="text-[11px] text-muted">
            {ar ? 'يسأل عن بياناتك المباشرة' : 'Ask about your live data'}
          </p>
        </div>
      </div>

      <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" style={{ maxHeight: 360 }}>
        {turns.length === 0 && (
          <div className="space-y-2 py-6 text-center">
            <p className="text-sm text-muted">
              {ar ? 'اسأل المساعد عن حالة عملك اليوم.' : 'Ask the copilot about your business today.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-primary hover:text-primary"
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
              className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                turn.role === 'user'
                  ? 'bg-primary text-white'
                  : 'border border-border bg-neutral-50 text-foreground'
              }`}
            >
              {turn.role === 'user' ? (
                <p className="whitespace-pre-wrap text-sm">{turn.content}</p>
              ) : (
                <SimpleMarkdown text={turn.content} />
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-border bg-neutral-50 px-3 py-2 text-sm text-muted">
              {ar ? '...يكتب' : 'thinking…'}
            </div>
          </div>
        )}
      </div>

      {error && <p className="px-4 text-xs text-danger">{error}</p>}

      <div className="flex items-center gap-2 border-t border-border p-3">
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
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <Button size="sm" onClick={() => void send()} disabled={busy || !input.trim()}>
          {t('common.send') || (ar ? 'إرسال' : 'Send')}
        </Button>
      </div>
    </div>
  );
}
