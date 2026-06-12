import { coerceLocale } from '@/lib/i18n';
import { fetchAgentsData } from '@/lib/admin-agents';
import { AgentsClient } from './agents-client';

export const dynamic = 'force-dynamic';

export default async function AgentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  coerceLocale(raw);
  const data = await fetchAgentsData();
  return <AgentsClient data={data} />;
}
