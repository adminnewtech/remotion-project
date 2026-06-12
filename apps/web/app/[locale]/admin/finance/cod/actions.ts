'use server';
import { getServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function recordCodRemittance(data: {
  driverId: string; amount: number; orderIds: string[]; note?: string;
}) {
  const sb = await getServerClient();
  const { data: remit, error } = await sb!
    .from('cod_remittances')
    .insert({ driver_id: data.driverId, amount: data.amount, order_ids: data.orderIds, note: data.note ?? null })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await sb!.rpc('post_cod_remittance', { p_remittance: remit.id });
  revalidatePath('/[locale]/admin/finance/cod', 'page');
}
