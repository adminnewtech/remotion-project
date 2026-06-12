'use client';

/**
 * ReviewForm — storefront review submission form.
 *
 * Arabic-first RTL; bilingual ar/en via useT + inline strings.
 * Tokens/layout consistent with surrounding storefront components.
 * Three terminal states: success | already-reviewed | sign-in required.
 */

import { useState, useTransition } from 'react';
import { Alert, Button, RatingInput } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { submitReview } from './review-actions';

interface ReviewFormProps {
  productId: string;
}

export function ReviewForm({ productId }: ReviewFormProps) {
  const { locale } = useT();
  const [isPending, startTransition] = useTransition();

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [state, setState] = useState<
    'idle' | 'success' | 'duplicate' | 'unauthenticated' | 'error'
  >('idle');
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return;

    startTransition(async () => {
      const result = await submitReview({ productId, rating, body });
      if (result.ok) {
        setState('success');
      } else if (result.reason === 'unauthenticated') {
        setState('unauthenticated');
      } else if (result.reason === 'duplicate') {
        setState('duplicate');
      } else {
        setState('error');
        setErrorMsg(result.message);
      }
    });
  }

  // ── Terminal states ────────────────────────────────────────
  if (state === 'success') {
    return (
      <Alert tone="success" className="mt-6">
        <p className="font-semibold">
          {locale === 'ar' ? 'شكراً على تقييمك!' : 'Thank you for your review!'}
        </p>
        <p className="mt-0.5 text-sm opacity-90">
          {locale === 'ar'
            ? 'سيظهر تقييمك بعد مراجعته من قِبَل الفريق.'
            : 'Your review will appear once it has been approved by our team.'}
        </p>
      </Alert>
    );
  }

  if (state === 'duplicate') {
    return (
      <Alert tone="info" className="mt-6">
        {locale === 'ar'
          ? 'لقد قيّمت هذا المنتج من قبل.'
          : 'You have already submitted a review for this product.'}
      </Alert>
    );
  }

  if (state === 'unauthenticated') {
    return (
      <Alert tone="warning" className="mt-6">
        {locale === 'ar'
          ? 'يجب تسجيل الدخول لإضافة تقييم.'
          : 'Please sign in to leave a review.'}
      </Alert>
    );
  }

  // ── Form (idle | error) ────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <h3 className="mb-4 text-base font-bold text-foreground">
        {locale === 'ar' ? 'أضف تقييمك' : 'Write a review'}
      </h3>

      {/* Star rating */}
      <div className="mb-4">
        <p className="mb-1.5 text-sm font-medium text-foreground">
          {locale === 'ar' ? 'تقييمك' : 'Your rating'}
          <span className="ms-1 text-danger">*</span>
        </p>
        <RatingInput
          value={rating}
          onValueChange={setRating}
          size="lg"
          label={locale === 'ar' ? 'تقييمك من 5 نجوم' : 'Rating out of 5 stars'}
          disabled={isPending}
        />
        {rating === 0 && (
          <p className="mt-1 text-xs text-muted">
            {locale === 'ar' ? 'اختر عدد النجوم' : 'Select a star rating'}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="mb-5">
        <label
          htmlFor="review-body"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          {locale === 'ar' ? 'رأيك (اختياري)' : 'Your review (optional)'}
        </label>
        <textarea
          id="review-body"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isPending}
          maxLength={2000}
          placeholder={
            locale === 'ar'
              ? 'شاركنا تجربتك مع هذا المنتج…'
              : 'Share your experience with this product…'
          }
          className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
        />
      </div>

      {/* DB error */}
      {state === 'error' && (
        <Alert tone="danger" className="mb-4">
          {locale === 'ar'
            ? `حدث خطأ أثناء الإرسال${errorMsg ? `: ${errorMsg}` : '.'}`
            : `An error occurred while submitting${errorMsg ? `: ${errorMsg}` : '.'}`}
        </Alert>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={rating === 0 || isPending}
        loading={isPending}
      >
        {isPending
          ? locale === 'ar'
            ? 'جارٍ الإرسال…'
            : 'Submitting…'
          : locale === 'ar'
            ? 'إرسال التقييم'
            : 'Submit review'}
      </Button>
    </form>
  );
}
