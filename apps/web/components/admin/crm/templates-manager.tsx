'use client';

import { useState, useTransition } from 'react';
import { saveTemplate, toggleTemplate } from '@/app/[locale]/admin/inbox/templates/actions';
import { useT } from '@/lib/use-t';

export interface Template {
  name: string;
  language: string;
  category: string;
  body: string;
  params: number;
  is_active: boolean;
}

// ── Param highlighting ────────────────────────────────────────────────────────
function HighlightedBody({ body }: { body: string }) {
  const parts = body.split(/({{[\d]+}})/g);
  return (
    <span>
      {parts.map((part, i) =>
        /^{{[\d]+}}$/.test(part) ? (
          <span
            key={i}
            className="inline-block rounded bg-osa-brand/10 px-1 text-[11px] font-bold text-osa-brand"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

// ── Template form modal ───────────────────────────────────────────────────────
function TemplateModal({
  initial,
  onClose,
}: {
  initial?: Template;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [language, setLanguage] = useState(initial?.language ?? 'ar');
  const [category, setCategory] = useState(initial?.category ?? 'utility');
  const [body, setBody] = useState(initial?.body ?? '');
  const [params, setParams] = useState(String(initial?.params ?? 0));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleSubmit() {
    if (!name.trim() || !body.trim()) {
      setError('الاسم والنص مطلوبان');
      return;
    }
    setError('');
    startTransition(async () => {
      try {
        await saveTemplate({
          name: name.trim(),
          language,
          category,
          body: body.trim(),
          params: parseInt(params) || 0,
        });
        onClose();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'حدث خطأ');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
      <div className="w-full max-w-lg rounded-osa border border-osa-border bg-osa-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-osa-ink">
            {initial ? 'تعديل القالب' : 'إضافة قالب'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-osa p-1 text-osa-muted hover:bg-osa-surface-2 hover:text-osa-ink"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11.5px] text-osa-muted">الاسم (مفتاح)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!initial}
              placeholder="مثال: order_paid"
              dir="ltr"
              className="w-full rounded-osa-sm border border-osa-border bg-osa-surface px-3 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border disabled:bg-osa-surface-2"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-[11.5px] text-osa-muted">اللغة</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-osa-sm border border-osa-border bg-osa-surface px-2 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border"
              >
                <option value="ar">العربية (ar)</option>
                <option value="en">الإنجليزية (en)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-[11.5px] text-osa-muted">التصنيف</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-osa-sm border border-osa-border bg-osa-surface px-2 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border"
              >
                <option value="utility">خدمة (utility)</option>
                <option value="marketing">تسويق (marketing)</option>
                <option value="authentication">مصادقة (authentication)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11.5px] text-osa-muted">
              نص القالب (استخدم {'{{1}}'}, {'{{2}}'} للمتغيرات)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="مثال: أهلاً {{1}}، طلبك رقم {{2}} جاهز."
              className="w-full rounded-osa-sm border border-osa-border bg-osa-surface px-3 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border resize-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11.5px] text-osa-muted">عدد المتغيرات</label>
            <input
              type="number"
              min={0}
              max={10}
              value={params}
              onChange={(e) => setParams(e.target.value)}
              className="w-24 rounded-osa-sm border border-osa-border bg-osa-surface px-3 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border"
            />
          </div>
          {error && <p className="text-[12px] text-osa-rose">{error}</p>}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-osa-sm border border-osa-border px-4 py-2 text-[13px] text-osa-muted transition-colors hover:bg-osa-surface-2"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-osa-sm bg-osa-brand px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {isPending ? '...' : initial ? 'حفظ التعديلات' : 'إضافة القالب'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main templates manager ────────────────────────────────────────────────────
export function TemplatesManager({ templates }: { templates: Template[] }) {
  const { locale } = useT();
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Template | null>(null);
  const [toggling, startToggle] = useTransition();

  function handleToggle(name: string, currentActive: boolean) {
    startToggle(async () => {
      try {
        await toggleTemplate(name, !currentActive);
      } catch (e) {
        console.error(e);
      }
    });
  }

  return (
    <div dir="rtl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <a href="../inbox" className="text-[12px] text-osa-brand hover:underline">
            {locale === 'ar' ? '← صندوق الرسائل' : '← Inbox'}
          </a>
        </div>
        <button
          onClick={() => {
            setEditTarget(null);
            setShowModal(true);
          }}
          className="rounded-osa-sm bg-osa-brand px-4 py-2 text-[13px] font-semibold text-white"
        >
          + إضافة قالب
        </button>
      </div>

      <div className="rounded-osa border border-osa-border bg-osa-surface shadow-osa overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-osa-border bg-osa-surface-2">
              <th className="px-4 py-3 text-start text-[11.5px] font-semibold text-osa-muted">الاسم</th>
              <th className="px-4 py-3 text-start text-[11.5px] font-semibold text-osa-muted">التصنيف</th>
              <th className="px-4 py-3 text-start text-[11.5px] font-semibold text-osa-muted">النص</th>
              <th className="px-4 py-3 text-start text-[11.5px] font-semibold text-osa-muted">اللغة</th>
              <th className="px-4 py-3 text-start text-[11.5px] font-semibold text-osa-muted">الحالة</th>
              <th className="px-4 py-3 text-start text-[11.5px] font-semibold text-osa-muted">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[13px] text-osa-muted">
                  لا توجد قوالب — أضف قالباً جديداً
                </td>
              </tr>
            ) : (
              templates.map((tpl) => (
                <tr
                  key={tpl.name}
                  className="border-b border-osa-border transition-colors last:border-0 hover:bg-osa-surface-2"
                >
                  <td className="px-4 py-3 font-mono text-[12px] text-osa-ink">{tpl.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                        tpl.category === 'marketing'
                          ? 'bg-osa-rose-dim text-osa-rose'
                          : tpl.category === 'authentication'
                            ? 'bg-osa-gold-dim text-osa-gold'
                            : 'bg-osa-blue-dim text-osa-blue'
                      }`}
                    >
                      {tpl.category === 'marketing'
                        ? 'تسويق'
                        : tpl.category === 'authentication'
                          ? 'مصادقة'
                          : 'خدمة'}
                    </span>
                  </td>
                  <td className="max-w-sm px-4 py-3 text-osa-ink">
                    <HighlightedBody body={tpl.body} />
                  </td>
                  <td className="px-4 py-3 text-osa-muted">{tpl.language}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(tpl.name, tpl.is_active)}
                      disabled={toggling}
                      className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${
                        tpl.is_active
                          ? 'bg-osa-green-dim text-osa-green hover:bg-osa-green/20'
                          : 'bg-osa-surface-2 text-osa-muted hover:bg-osa-border'
                      }`}
                    >
                      {tpl.is_active ? 'مفعّل' : 'موقوف'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setEditTarget(tpl);
                        setShowModal(true);
                      }}
                      className="text-[12px] text-osa-brand hover:underline"
                    >
                      تعديل
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <TemplateModal
          initial={editTarget ?? undefined}
          onClose={() => {
            setShowModal(false);
            setEditTarget(null);
          }}
        />
      )}
    </div>
  );
}
