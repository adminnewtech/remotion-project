'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';

export interface IssueGiftCardInput {
  amount: number;
  recipientPhone?: string;
  expiryDays?: number;
}

export interface IssueGiftCardResult {
  ok: boolean;
  code: string;
  live: boolean;
  error?: string;
}

function revalidate() {
  revalidatePath('/[locale]/admin/marketing/gift-cards', 'page');
}

export async function issueGiftCard(input: IssueGiftCardInput): Promise<IssueGiftCardResult> {
  const sb = await getServerClient();
  if (!sb) {
    // Sample mode: return a synthetic code
    return { ok: true, code: 'GC-SAMPLE00000000', live: false };
  }

  try {
    const { data, error } = await sb.rpc('issue_gift_card', {
      p_order_id: null,
      p_amount: input.amount,
      p_recipient_phone: input.recipientPhone ?? null,
      p_expires_days: input.expiryDays ?? 365,
    });
    if (error) throw new Error(error.message);
    revalidate();
    return { ok: true, code: data as string, live: true };
  } catch (e) {
    return { ok: false, code: '', live: true, error: (e as Error).message };
  }
}

export async function voidGiftCard(id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerClient();
  if (!sb) return { ok: true };

  try {
    const { error } = await sb
      .from('gift_cards')
      .update({ status: 'voided' })
      .eq('id', id);
    if (error) throw new Error(error.message);
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
