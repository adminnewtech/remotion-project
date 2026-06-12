import { coerceLocale } from '@/lib/i18n';
import { fetchWishlistInsights } from '@/lib/admin-wishlists';
import { WishlistsClient } from './wishlists-client';

export const dynamic = 'force-dynamic';

export default async function WishlistsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  coerceLocale(raw);
  const data = await fetchWishlistInsights();
  return <WishlistsClient data={data} />;
}
