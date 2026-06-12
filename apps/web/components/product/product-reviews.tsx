'use client';

import type { Review } from '@elite/types';
import { Rating } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { ReviewForm } from './review-form';

/**
 * Reviews section scaffold. Shows an aggregate summary with a 5→1 star
 * histogram and the published reviews; a tasteful empty state ("be the first
 * to review") when there are none. Includes the ReviewForm for authenticated
 * users to submit a new review (pending moderation).
 */
export function ProductReviews({ reviews, productId }: { reviews: Review[]; productId: string }) {
  const { t, locale } = useT();

  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  const histogram = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: reviews.filter((r) => Math.round(r.rating) === star).length,
  }));

  return (
    <section className="mt-12">
      <h2 className="mb-5 text-xl font-bold text-foreground">{t('product.reviews')}</h2>

      {count === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
          <Rating value={0} size="md" />
          <p className="text-base font-bold text-foreground">
            {locale === 'ar' ? 'كن أول من يقيّم هذا المنتج' : 'Be the first to review this product'}
          </p>
          <p className="max-w-sm text-sm text-muted">
            {locale === 'ar'
              ? 'شاركنا رأيك بعد الشراء لمساعدة عملاء نيوتك الآخرين.'
              : 'Share your experience after purchase to help other Newtech shoppers.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* Summary */}
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-foreground">{avg.toFixed(1)}</span>
              <span className="text-sm text-muted">/ 5</span>
            </div>
            <div className="mt-1">
              <Rating value={avg} count={count} size="sm" />
            </div>
            <div className="mt-4 space-y-1.5">
              {histogram.map(({ star, n }) => (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-muted">{star}</span>
                  <StarGlyph />
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <span
                      className="block h-full rounded-full bg-warning-500"
                      style={{ width: count ? `${(n / count) * 100}%` : '0%' }}
                    />
                  </span>
                  <span className="w-5 text-end text-muted">{n}</span>
                </div>
              ))}
            </div>
          </div>

          {/* List */}
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <Rating value={r.rating} size="sm" />
                {r.body && <p className="mt-2 text-sm leading-relaxed text-foreground">{r.body}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Submission form — always visible; form handles sign-in/duplicate states */}
      <ReviewForm productId={productId} />
    </section>
  );
}

function StarGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="text-warning-500">
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
