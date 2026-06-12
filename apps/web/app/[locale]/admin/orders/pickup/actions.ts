'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';

function revalidate() {
  revalidatePath('/[locale]/admin/orders/pickup', 'page');
}

export interface VerifyPickupResult {
  ok: boolean;
  error?: string;
}

export async function verifyPickup(
  orderId: string,
  providedCode: string,
): Promise<VerifyPickupResult> {
  const sb = await getServerClient();
  if (!sb) {
    // Sample mode: accept any non-empty code
    return providedCode.trim() ? { ok: true } : { ok: false, error: 'أدخل كود الاستلام' };
  }

  try {
    // Fetch the order to verify the pickup_code
    const { data: order, error: fetchErr } = await sb
      .from('orders')
      .select('id, pickup_code, status')
      .eq('id', orderId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!order) throw new Error('الطلب غير موجود');

    const o = order as { id: string; pickup_code: string | null; status: string };

    if (!o.pickup_code) throw new Error('لا يوجد كود استلام لهذا الطلب');
    if (o.pickup_code.trim() !== providedCode.trim()) {
      return { ok: false, error: 'كود الاستلام غير صحيح' };
    }

    const { error: updateErr } = await sb
      .from('orders')
      .update({ status: 'completed' })
      .eq('id', orderId);

    if (updateErr) throw new Error(updateErr.message);
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function markReadyForPickup(orderId: string): Promise<VerifyPickupResult> {
  const sb = await getServerClient();
  if (!sb) return { ok: true };

  try {
    const { error } = await sb
      .from('orders')
      .update({ status: 'ready_for_pickup' })
      .eq('id', orderId);
    if (error) throw new Error(error.message);
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
