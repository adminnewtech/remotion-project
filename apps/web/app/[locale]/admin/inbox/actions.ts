'use server';
import { revalidatePath } from 'next/cache';

export async function sendWhatsApp(data: {
  phone: string;
  body?: string;
  template?: string;
  params?: string[];
  ticket_id?: string;
}) {
  const fnUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1/whatsapp-send';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  }
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((err as { error?: string }).error ?? 'Send failed');
  }
  revalidatePath('/[locale]/admin/inbox', 'page');
  return res.json();
}
