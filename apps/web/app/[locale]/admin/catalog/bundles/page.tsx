import { coerceLocale } from '@/lib/i18n';
import { fetchBundles } from '@/lib/admin-commerce';
import { BundlesClient } from './bundles-client';

export const dynamic = 'force-dynamic';

export default async function BundlesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  coerceLocale(raw);
  const data = await fetchBundles();
  return <BundlesClient data={data} />;
}
