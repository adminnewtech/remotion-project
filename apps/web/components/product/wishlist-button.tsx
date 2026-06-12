'use client';

/**
 * WishlistButton — heart toggle for the product detail page.
 *
 * - Signed-in users: optimistic toggle (heart fills/unfills immediately) →
 *   fires the toggleWishlist server action → rolls back on failure.
 * - Unauthenticated users: button redirects to the sign-in page with a
 *   `?next=` redirect back to the current page.
 * - No Supabase env: renders a disabled placeholder so the page still builds.
 */

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSupabase } from '@/components/providers';
import { useLocale } from '@/components/providers';
import { toggleWishlist } from '@/components/product/wishlist-actions';
import { hasSupabaseEnv } from '@/lib/env';

interface WishlistButtonProps {
  productId: string;
  /** Initial server-resolved wishlisted state (from RSC). */
  initialWishlisted?: boolean;
}

export function WishlistButton({ productId, initialWishlisted = false }: WishlistButtonProps) {
  const { locale } = useLocale();
  const supabase = useSupabase();
  const router = useRouter();
  const pathname = usePathname();
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [isPending, startTransition] = useTransition();

  const labelAr = wishlisted ? 'إزالة من المفضلة' : 'أضف إلى المفضلة';
  const labelEn = wishlisted ? 'Remove from wishlist' : 'Add to wishlist';
  const label = locale === 'ar' ? labelAr : labelEn;

  // No client available (no env) — render a disabled shell so the panel builds.
  if (!hasSupabaseEnv) {
    return (
      <WishlistButtonShell
        wishlisted={false}
        label={label}
        disabled
        onClick={() => {}}
        isPending={false}
      />
    );
  }

  function handleClick() {
    // If not authenticated (no supabase session context), redirect to sign-in.
    if (!supabase) {
      const loginPath = `/${locale}/auth/login?next=${encodeURIComponent(pathname ?? '/')}`;
      router.push(loginPath);
      return;
    }

    const next = !wishlisted;
    // Optimistic update
    setWishlisted(next);

    startTransition(async () => {
      const result = await toggleWishlist({ productId });
      if (!result.ok) {
        if (result.error === 'unauthenticated') {
          // Session expired — redirect
          setWishlisted(initialWishlisted);
          router.push(`/${locale}/auth/login?next=${encodeURIComponent(pathname ?? '/')}`);
          return;
        }
        // Roll back optimistic update on other errors
        setWishlisted(!next);
      } else {
        setWishlisted(result.wishlisted ?? next);
      }
    });
  }

  return (
    <WishlistButtonShell
      wishlisted={wishlisted}
      label={label}
      disabled={isPending}
      onClick={handleClick}
      isPending={isPending}
    />
  );
}

// ── Pure rendering shell ────────────────────────────────────

function WishlistButtonShell({
  wishlisted,
  label,
  disabled,
  onClick,
  isPending,
}: {
  wishlisted: boolean;
  label: string;
  disabled: boolean;
  onClick: () => void;
  isPending: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={wishlisted}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition
        ${
          wishlisted
            ? 'border-danger-300 bg-danger-50 text-danger-600 hover:bg-danger-100'
            : 'border-border bg-surface text-muted hover:border-danger-300 hover:text-danger-500'
        }
        ${isPending ? 'opacity-60 cursor-wait' : 'cursor-pointer'}
        disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <HeartIcon filled={wishlisted} />
      <span>{label}</span>
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
