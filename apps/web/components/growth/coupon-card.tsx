'use client';

import { useState } from 'react';
import { useT } from '@/lib/use-t';

/**
 * Copyable promo-code coupon card. Click-to-copy with a transient "copied"
 * confirmation. Visual language matches the homepage OffersBanner (accent→
 * primary gradient, rounded-3xl, soft radial highlight).
 */
export function CouponCard({
  code,
  headline,
  sub,
}: {
  code: string;
  headline: string;
  sub: string;
}) {
  const { t, locale } = useT();
  const ar = locale === 'ar';
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-accent-600 to-primary p-6 text-white shadow-lg sm:p-10">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 88% 50%, rgba(255,255,255,0.25), transparent 42%)',
        }}
        aria-hidden
      />
      <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
            {t('offers.limitedOffer')}
          </span>
          <h2 className="mt-3 text-2xl font-black sm:text-3xl">{headline}</h2>
          <p className="mt-1 max-w-md text-white/85">{sub}</p>
        </div>

        <button
          type="button"
          onClick={copy}
          aria-label={ar ? `نسخ الرمز ${code}` : `Copy code ${code}`}
          className="group flex shrink-0 items-center gap-3 rounded-2xl border-2 border-dashed border-white/70 bg-white/10 px-5 py-3.5 backdrop-blur transition hover:bg-white/20 active:scale-95"
        >
          <span className="text-xl font-black tracking-widest">{code}</span>
          <span className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-sm font-bold text-primary">
            {copied ? (
              <>
                <CheckIcon />
                {ar ? 'تم النسخ' : 'Copied'}
              </>
            ) : (
              <>
                <CopyIcon />
                {ar ? 'نسخ' : 'Copy'}
              </>
            )}
          </span>
        </button>
      </div>
    </section>
  );
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
