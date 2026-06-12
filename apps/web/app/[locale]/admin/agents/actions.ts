'use server';
import { getServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function toggleAgentKillSwitch(key: string, enabled: boolean) {
  const sb = await getServerClient();
  if (!sb) throw new Error('No database connection');

  // Read current ai column
  const { data, error: readErr } = await sb
    .from('app_settings')
    .select('ai')
    .eq('id', 1)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);

  const current = (data?.ai as Record<string, boolean> | null) ?? {};
  const updated = { ...current, [key]: enabled };

  const { error } = await sb
    .from('app_settings')
    .update({ ai: updated } as never)
    .eq('id', 1);
  if (error) throw new Error(error.message);

  revalidatePath('/[locale]/admin/agents', 'page');
}
