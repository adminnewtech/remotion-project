import { coerceLocale } from '@/lib/i18n';
import { fetchWarranties } from '@/lib/admin-warranties';
import { WarrantiesClient } from './warranties-client';

export const dynamic = 'force-dynamic';

export default async function WarrantiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  coerceLocale(raw);
  const data = await fetchWarranties();
  return <WarrantiesClient data={data} />;
}
