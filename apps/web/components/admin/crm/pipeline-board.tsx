'use client';

import { useState, useTransition } from 'react';
import type { PipelineData, StageData, DealRow } from '@/lib/admin-crm-pipeline';
import { moveDeal, createDeal, addDealNote } from '@/app/[locale]/admin/crm/actions';
import { fmtKWD, fmtDate } from '@/lib/format';
import { useT } from '@/lib/use-t';

// ── Source badge ──────────────────────────────────────────────────────────────
const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'واتساب',
  walk_in: 'زيارة',
  web: 'الموقع',
  referral: 'إحالة',
  agent: 'مندوب',
};

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  const label = SOURCE_LABELS[source] ?? source;
  const cls =
    source === 'whatsapp'
      ? 'bg-osa-green-dim text-osa-green'
      : source === 'web'
        ? 'bg-osa-blue-dim text-osa-blue'
        : 'bg-osa-surface-2 text-osa-muted';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ── Deal card ─────────────────────────────────────────────────────────────────
function DealCard({
  deal,
  onClick,
}: {
  deal: DealRow;
  onClick: () => void;
}) {
  const { locale } = useT();
  return (
    <button
      onClick={onClick}
      className="w-full rounded-osa border border-osa-border bg-osa-surface p-3 text-start shadow-osa transition-all hover:border-osa-brand-border hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-[12px] font-bold text-osa-ink leading-snug">{deal.title}</p>
        <span className="num shrink-0 text-[11px] text-osa-muted">{deal.dealNumber}</span>
      </div>
      {deal.customerName && (
        <p className="mt-1 text-[11.5px] text-osa-muted truncate">{deal.customerName}</p>
      )}
      <div className="mt-2 flex items-center justify-between gap-1">
        <span className="num text-[12px] font-bold text-osa-brand">
          {fmtKWD(deal.value, locale)}
        </span>
        <SourceBadge source={deal.source} />
      </div>
      {deal.expectedClose && (
        <p className="mt-1 text-[10.5px] text-osa-faint">
          {locale === 'ar' ? 'الإغلاق:' : 'Close:'} {fmtDate(deal.expectedClose, locale)}
        </p>
      )}
    </button>
  );
}

// ── Stage column ──────────────────────────────────────────────────────────────
function StageColumn({
  stage,
  pipelineId,
  onDealClick,
  locale,
}: {
  stage: StageData;
  pipelineId: string | null;
  onDealClick: (deal: DealRow) => void;
  locale: string;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!newTitle.trim() || !pipelineId) return;
    startTransition(async () => {
      try {
        await createDeal({
          title: newTitle.trim(),
          value: parseFloat(newValue) || 0,
          stageId: stage.id,
          pipelineId,
        });
        setNewTitle('');
        setNewValue('');
        setShowCreate(false);
      } catch (e) {
        console.error(e);
      }
    });
  }

  return (
    <div className="flex w-64 shrink-0 flex-col rounded-osa border border-osa-border bg-osa-surface-2">
      {/* Column header */}
      <div className="flex items-center justify-between gap-2 border-b border-osa-border px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <span className="truncate text-[13px] font-bold text-osa-ink">{stage.name}</span>
          <span className="shrink-0 rounded-full bg-osa-surface px-1.5 py-0.5 text-[10.5px] font-semibold text-osa-muted">
            {stage.deals.length}
          </span>
        </div>
        <span className="num shrink-0 text-[11px] text-osa-muted">
          {fmtKWD(stage.totalValue, locale)}
        </span>
      </div>

      {/* Deal cards */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {stage.deals.map((d) => (
          <DealCard key={d.id} deal={d} onClick={() => onDealClick(d)} />
        ))}

        {/* Inline create form */}
        {showCreate ? (
          <div className="rounded-osa border border-osa-brand-border bg-osa-surface p-2 space-y-2">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="عنوان الصفقة"
              className="w-full rounded-osa-sm border border-osa-border bg-osa-surface px-2 py-1.5 text-[12px] text-osa-ink outline-none focus:border-osa-brand-border"
            />
            <input
              type="number"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="القيمة (KWD)"
              className="w-full rounded-osa-sm border border-osa-border bg-osa-surface px-2 py-1.5 text-[12px] text-osa-ink outline-none focus:border-osa-brand-border"
            />
            <div className="flex gap-1">
              <button
                onClick={handleCreate}
                disabled={isPending || !newTitle.trim()}
                className="flex-1 rounded-osa-sm bg-osa-brand px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {isPending ? '...' : 'إضافة'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-osa-sm border border-osa-border px-2 py-1 text-[11px] text-osa-muted"
              >
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full rounded-osa border border-dashed border-osa-border px-2 py-2 text-[12px] text-osa-muted transition-colors hover:border-osa-brand-border hover:text-osa-brand"
          >
            + إنشاء صفقة جديدة
          </button>
        )}
      </div>
    </div>
  );
}

// ── Deal drawer ───────────────────────────────────────────────────────────────
function DealDrawer({
  deal,
  stages,
  onClose,
}: {
  deal: DealRow;
  stages: StageData[];
  onClose: () => void;
}) {
  const { locale } = useT();
  const [note, setNote] = useState('');
  const [selectedStage, setSelectedStage] = useState(deal.stageId);
  const [isPending, startTransition] = useTransition();
  const [notesPending, startNoteTransition] = useTransition();
  const [tab, setTab] = useState<'info' | 'notes'>('info');

  function handleStageChange(stageId: string) {
    if (stageId === selectedStage) return;
    setSelectedStage(stageId);
    startTransition(async () => {
      try {
        await moveDeal(deal.id, stageId);
      } catch (e) {
        console.error(e);
        setSelectedStage(deal.stageId);
      }
    });
  }

  function handleAddNote() {
    if (!note.trim()) return;
    startNoteTransition(async () => {
      try {
        await addDealNote(deal.id, note.trim());
        setNote('');
      } catch (e) {
        console.error(e);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Drawer panel */}
      <div className="flex h-full w-full max-w-sm flex-col border-s border-osa-border bg-osa-surface shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-osa-border p-4">
          <div className="min-w-0">
            <p className="num text-[11px] text-osa-muted">{deal.dealNumber}</p>
            <h2 className="mt-0.5 text-[15px] font-bold text-osa-ink leading-snug">{deal.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-osa p-1 text-osa-muted transition-colors hover:bg-osa-surface-2 hover:text-osa-ink"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-osa-border">
          {(['info', 'notes'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[12px] font-semibold transition-colors ${
                tab === t
                  ? 'border-b-2 border-osa-brand text-osa-brand'
                  : 'text-osa-muted hover:text-osa-ink'
              }`}
            >
              {t === 'info' ? 'التفاصيل' : 'الملاحظات'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'info' ? (
            <dl className="space-y-4 text-[13px]">
              <div>
                <dt className="mb-1 text-[11px] text-osa-muted">القيمة</dt>
                <dd className="num text-xl font-extrabold text-osa-brand">
                  {fmtKWD(deal.value, locale)}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-[11px] text-osa-muted">المرحلة</dt>
                <dd>
                  <select
                    value={selectedStage}
                    onChange={(e) => handleStageChange(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-osa-sm border border-osa-border bg-osa-surface px-2 py-1.5 text-[12px] text-osa-ink outline-none focus:border-osa-brand-border disabled:opacity-50"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
              {deal.customerName && (
                <div>
                  <dt className="mb-1 text-[11px] text-osa-muted">العميل</dt>
                  <dd className="text-osa-ink">{deal.customerName}</dd>
                </div>
              )}
              {deal.source && (
                <div>
                  <dt className="mb-1 text-[11px] text-osa-muted">المصدر</dt>
                  <dd>
                    <SourceBadge source={deal.source} />
                  </dd>
                </div>
              )}
              {deal.expectedClose && (
                <div>
                  <dt className="mb-1 text-[11px] text-osa-muted">تاريخ الإغلاق المتوقع</dt>
                  <dd className="num text-osa-ink">{fmtDate(deal.expectedClose, locale)}</dd>
                </div>
              )}
              <div>
                <dt className="mb-1 text-[11px] text-osa-muted">تاريخ الإنشاء</dt>
                <dd className="num text-osa-ink">{fmtDate(deal.createdAt, locale)}</dd>
              </div>
            </dl>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="أضف ملاحظة..."
                  className="flex-1 rounded-osa-sm border border-osa-border bg-osa-surface px-2 py-1.5 text-[12px] text-osa-ink outline-none focus:border-osa-brand-border"
                />
                <button
                  onClick={handleAddNote}
                  disabled={notesPending || !note.trim()}
                  className="rounded-osa-sm bg-osa-brand px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  {notesPending ? '...' : 'إضافة'}
                </button>
              </div>
              <p className="text-[11.5px] text-osa-faint text-center">
                سجل الأحداث متاح من لوحة التحكم
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main pipeline board ───────────────────────────────────────────────────────
export function PipelineBoard({ data }: { data: PipelineData }) {
  const { locale } = useT();
  const [selectedDeal, setSelectedDeal] = useState<DealRow | null>(null);

  // Won this month
  const wonStage = data.stages.find((s) => s.isWon);
  const now = new Date();
  const wonThisMonth = wonStage
    ? wonStage.deals.filter((d) => {
        const created = new Date(d.createdAt);
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      }).length
    : 0;

  return (
    <div dir="rtl">
      {/* Summary row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="rounded-osa border border-osa-border bg-osa-surface px-4 py-2.5 shadow-osa">
          <p className="text-[11px] text-osa-muted">إجمالي الصفقات</p>
          <p className="num mt-0.5 text-lg font-extrabold text-osa-ink">{data.totalDeals}</p>
        </div>
        <div className="rounded-osa border border-osa-border bg-osa-surface px-4 py-2.5 shadow-osa">
          <p className="text-[11px] text-osa-muted">قيمة الخط</p>
          <p className="num mt-0.5 text-lg font-extrabold text-osa-brand">
            {fmtKWD(data.totalPipelineValue, locale)}
          </p>
        </div>
        <div className="rounded-osa border border-osa-border bg-osa-surface px-4 py-2.5 shadow-osa">
          <p className="text-[11px] text-osa-muted">فوز هذا الشهر</p>
          <p className="num mt-0.5 text-lg font-extrabold text-osa-green">{wonThisMonth}</p>
        </div>
        {!data.live && (
          <span className="rounded-full bg-osa-gold-dim px-3 py-1 text-[11px] font-semibold text-osa-gold">
            بيانات تجريبية
          </span>
        )}
      </div>

      {/* Kanban columns — horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {data.stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            pipelineId={data.pipelineId}
            onDealClick={setSelectedDeal}
            locale={locale}
          />
        ))}
      </div>

      {/* Deal drawer */}
      {selectedDeal && (
        <DealDrawer
          deal={selectedDeal}
          stages={data.stages}
          onClose={() => setSelectedDeal(null)}
        />
      )}
    </div>
  );
}
