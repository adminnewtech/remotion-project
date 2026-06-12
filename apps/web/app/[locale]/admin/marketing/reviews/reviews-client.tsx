'use client';

import { useState, useTransition } from 'react';
import { Button, Badge } from '@elite/ui/web';
import { PageHeader, KpiCard } from '@/components/admin/ui';
import { RoleGuard } from '@/components/role-guard';
import type { ReviewsData, ReviewRow } from '@/lib/admin-commerce';
import { approveReview, rejectReview, replyToReview } from './actions';

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';

const TAB_LABELS: Record<FilterTab, string> = {
  all: 'الكل',
  pending: 'بانتظار المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} من 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`h-4 w-4 ${s <= rating ? 'text-warning-500 fill-warning-500' : 'text-neutral-300 fill-neutral-300'}`}
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewRow }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState(review.reply ?? '');
  const [approving, startApprove] = useTransition();
  const [rejecting, startReject] = useTransition();
  const [replying, startReply] = useTransition();

  const statusBadge = {
    pending: <Badge variant="warning">بانتظار المراجعة</Badge>,
    approved: <Badge variant="success">مقبول</Badge>,
    rejected: <Badge variant="danger">مرفوض</Badge>,
  }[review.status];

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{review.productName}</p>
          <p className="text-sm text-muted">{review.customerName}</p>
        </div>
        <div className="flex items-center gap-2">
          {review.verified && (
            <Badge variant="info">مشترٍ موثّق</Badge>
          )}
          {statusBadge}
        </div>
      </div>

      <StarRating rating={review.rating} />

      {review.body && (
        <p className="text-sm leading-relaxed">{review.body}</p>
      )}

      {review.reply && !replyOpen && (
        <div className="rounded-md bg-neutral-50 border border-border px-3 py-2 text-sm">
          <span className="font-medium text-muted">ردّنا: </span>{review.reply}
        </div>
      )}

      {replyOpen && (
        <div className="space-y-2">
          <textarea
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm resize-none"
            rows={3}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="اكتب ردّك هنا…"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={replying}
              onClick={() =>
                startReply(async () => {
                  await replyToReview(review.id, replyText);
                  setReplyOpen(false);
                })
              }
            >
              إرسال الرد
            </Button>
            <Button size="sm" variant="outline" onClick={() => setReplyOpen(false)}>
              إلغاء
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {review.status !== 'approved' && (
          <Button
            size="sm"
            variant="secondary"
            loading={approving}
            onClick={() => startApprove(() => approveReview(review.id))}
          >
            قبول
          </Button>
        )}
        {review.status !== 'rejected' && (
          <Button
            size="sm"
            variant="danger"
            loading={rejecting}
            onClick={() => startReject(() => rejectReview(review.id))}
          >
            رفض
          </Button>
        )}
        {!replyOpen && (
          <Button size="sm" variant="outline" onClick={() => setReplyOpen(true)}>
            {review.reply ? 'تعديل الرد' : 'إضافة رد'}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ReviewsClient({ data }: { data: ReviewsData }) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filtered = data.reviews.filter((r) => {
    if (activeTab === 'all') return true;
    return r.status === activeTab;
  });

  return (
    <RoleGuard allow={['admin', 'ops']}>
      <PageHeader
        title="التقييمات — Reviews"
        subtitle="مراجعة وإدارة تقييمات العملاء"
        actions={
          data.pendingCount > 0 ? (
            <Badge variant="warning">{data.pendingCount} بانتظار المراجعة</Badge>
          ) : undefined
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="إجمالي التقييمات" value={String(data.reviews.length)} />
        <KpiCard label="بانتظار المراجعة" value={String(data.pendingCount)} />
        <KpiCard
          label="مقبولة"
          value={String(data.reviews.filter((r) => r.status === 'approved').length)}
        />
        <KpiCard
          label="مرفوضة"
          value={String(data.reviews.filter((r) => r.status === 'rejected').length)}
        />
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
        {(Object.keys(TAB_LABELS) as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {TAB_LABELS[tab]}
            {tab === 'pending' && data.pendingCount > 0 && (
              <span className="ms-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-warning-500 text-[10px] text-white font-bold">
                {data.pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-muted">
          لا توجد تقييمات في هذه الفئة.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}
    </RoleGuard>
  );
}
