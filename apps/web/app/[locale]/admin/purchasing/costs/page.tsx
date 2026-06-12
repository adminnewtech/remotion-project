import { coerceLocale } from '@/lib/i18n';
import { fetchPoCosts } from '@/lib/admin-landed-costs';
import { CostsClient } from './costs-client';

export const dynamic = 'force-dynamic';

export default async function LandedCostsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  coerceLocale(raw);
  const data = await fetchPoCosts();
  return <CostsClient data={data} />;
}
