'use server';
import { getServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function saveTemplate(data: {
  name: string;
  language: string;
  category: string;
  body: string;
  params: number;
}) {
  const sb = await getServerClient();
  if (!sb) throw new Error('No database connection');
  const { error } = await sb.from('wa_templates').upsert(data, { onConflict: 'name' });
  if (error) throw new Error(error.message);
  revalidatePath('/[locale]/admin/inbox/templates', 'page');
}

export async function toggleTemplate(name: string, active: boolean) {
  const sb = await getServerClient();
  if (!sb) throw new Error('No database connection');
  const { error } = await sb.from('wa_templates').update({ is_active: active }).eq('name', name);
  if (error) throw new Error(error.message);
  revalidatePath('/[locale]/admin/inbox/templates', 'page');
}
