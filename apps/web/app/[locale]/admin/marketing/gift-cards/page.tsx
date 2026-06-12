import { coerceLocale } from '@/lib/i18n';
import { fetchGiftCards } from '@/lib/admin-commerce';
import { GiftCardsClient } from './gift-cards-client';

export const dynamic = 'force-dynamic';

export default async function GiftCardsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  coerceLocale(raw);
  const data = await fetchGiftCards();
  return <GiftCardsClient data={data} />;
}
