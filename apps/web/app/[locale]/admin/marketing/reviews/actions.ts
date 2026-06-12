'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';

function revalidate() {
  revalidatePath('/[locale]/admin/marketing/reviews', 'page');
}

export async function approveReview(id: string) {
  const sb = await getServerClient();
  if (!sb) return;
  const { error } = await sb.from('reviews').update({ status: 'approved' }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidate();
}

export async function rejectReview(id: string) {
  const sb = await getServerClient();
  if (!sb) return;
  const { error } = await sb.from('reviews').update({ status: 'rejected' }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidate();
}

export async function replyToReview(id: string, reply: string) {
  const sb = await getServerClient();
  if (!sb) return;
  const { error } = await sb.from('reviews').update({ reply }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidate();
}
