'use server';

/** Appointments actions — book/complete/cancel تركيب/معاينة/استلام (0024). */
import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';

export interface ApptResult { ok: boolean; live: boolean; id?: string; error?: string }

export async function bookAppointment(
  kind: 'installation' | 'inspection' | 'pickup',
  customerName: string,
  phone: string | null,
  orderNumber: string | null,
  scheduledAt: string,
  note: string | null,
): Promise<ApptResult> {
  if (!customerName.trim() || !scheduledAt) return { ok: false, live: false, error: 'input' };
  const client = await getServerClient();
  if (!client) return { ok: true, live: false, id: `demo-${Date.now()}` };
  const { data, error } = await client.from('appointments').insert({
    kind, customer_name: customerName.trim(), phone, order_number: orderNumber,
    scheduled_at: new Date(scheduledAt).toISOString(), note,
  }).select('id').single();
  if (error) return { ok: false, live: true, error: error.message };
  revalidatePath('/[locale]/admin/appointments', 'page');
  return { ok: true, live: true, id: (data as { id: string }).id };
}

export async function setAppointmentStatus(id: string, status: 'done' | 'cancelled' | 'booked'): Promise<ApptResult> {
  const client = await getServerClient();
  if (!client) return { ok: true, live: false };
  const { error } = await client.from('appointments').update({ status }).eq('id', id);
  if (error) return { ok: false, live: true, error: error.message };
  revalidatePath('/[locale]/admin/appointments', 'page');
  return { ok: true, live: true, id };
}
