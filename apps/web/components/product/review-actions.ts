'use server';

/**
 * Storefront review submission action.
 *
 * - Requires a signed-in user (auth.getUser).
 * - Inserts into `reviews` with status='pending' (moderation queue).
 * - Prevents duplicate review per user+product pair.
 * - Returns a typed result union — never throws to the client.
 */

import { getServerClient } from '@/lib/supabase/server';

export type SubmitReviewResult =
  | { ok: true }
  | { ok: false; reason: 'unauthenticated' | 'duplicate' | 'db_error'; message?: string };

export async function submitReview({
  productId,
  rating,
  body,
}: {
  productId: string;
  rating: number;
  body: string;
}): Promise<SubmitReviewResult> {
  const sb = await getServerClient();
  if (!sb) {
    // No backend — treat as unauthenticated in sample mode.
    return { ok: false, reason: 'unauthenticated' };
  }

  // 1. Require a signed-in user.
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return { ok: false, reason: 'unauthenticated' };
  }

  // 2. Check for an existing review by this user for this product.
  const { data: existing, error: checkErr } = await sb
    .from('reviews')
    .select('id')
    .eq('product_id', productId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (checkErr) {
    return { ok: false, reason: 'db_error', message: checkErr.message };
  }
  if (existing) {
    return { ok: false, reason: 'duplicate' };
  }

  // 3. Insert pending review (trigger sets `verified` automatically).
  const { error: insertErr } = await sb.from('reviews').insert({
    product_id: productId,
    user_id: user.id,
    rating,
    body: body.trim() || null,
    status: 'pending',
    is_published: false,
  });

  if (insertErr) {
    // Unique constraint violation means a race to duplicate.
    if (insertErr.code === '23505') {
      return { ok: false, reason: 'duplicate' };
    }
    return { ok: false, reason: 'db_error', message: insertErr.message };
  }

  return { ok: true };
}
