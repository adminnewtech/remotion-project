'use client';

import { useState } from 'react';
import { ai } from '@elite/core';
import type { AiReport } from '@elite/core';
import { Button } from '@elite/ui/web';
import { useSupabase } from '@/components/providers';
import { useT } from '@/lib/use-t';
import { SimpleMarkdown } from './markdown';

/**
 * "AI Daily Brief" card. Renders the latest `daily_brief` report and offers a
 * "generate now" button that invokes the `daily-report` Edge Function
 * (ai.triggerDailyReport) and swaps in the fresh result.
 */
export function DailyBriefCard({ initial }: { initial: AiReport | null }) {
  const { locale } = useT();
  const supabase = useSupabase();
  const ar = locale === 'ar';
  const [report, setReport] = useState<AiReport | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await ai.triggerDailyReport(supabase, { notify: false });
      setReport(res.report);
    } catch {
      setError(ar ? 'تعذّر توليد الموجز.' : 'Could not generate the brief.');
    } finally {
      setBusy(false);
    }
  }

  const aiBadge = report?.data && (report.data as { ai?: boolean }).ai;

  return (
    <div className="rounded-osa border border-osa-brand-border bg-osa-brand-dim p-5 shadow-osa">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-osa-sm bg-gradient-to-br from-osa-brand-strong to-osa-brand text-[13px] font-black text-white">
            AI
          </span>
          <div>
            <h2 className="text-[15px] font-bold leading-none text-osa-ink">
              {ar ? 'الموجز اليومي الذكي' : 'AI Daily Brief'}
            </h2>
            <p className="text-[11px] text-osa-muted">
              {report
                ? new Date(report.created_at).toLocaleString(ar ? 'ar-KW' : 'en-GB')
                : ar
                  ? 'لم يُولَّد بعد'
                  : 'Not generated yet'}
              {aiBadge ? ' · Claude' : report ? ' · auto' : ''}
            </p>
          </div>
        </div>
        <Button size="sm" variant="primary" onClick={() => void generate()} loading={busy}>
          {ar ? 'توليد الآن' : 'Generate now'}
        </Button>
      </div>

      {error && <p className="mb-2 text-[11.5px] text-osa-rose">{error}</p>}

      <div className="max-h-72 overflow-y-auto rounded-osa-sm bg-osa-surface/80 p-4 text-osa-ink">
        {report ? (
          <SimpleMarkdown text={report.body_md} />
        ) : (
          <p className="py-6 text-center text-[13px] text-osa-muted">
            {ar
              ? 'اضغط «توليد الآن» لإنشاء أول موجز تنفيذي.'
              : 'Press “Generate now” to create the first executive brief.'}
          </p>
        )}
      </div>
    </div>
  );
}
