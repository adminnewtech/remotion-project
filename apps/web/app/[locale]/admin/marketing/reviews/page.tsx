import { coerceLocale } from '@/lib/i18n';
import { fetchReviews } from '@/lib/admin-commerce';
import { ReviewsClient } from './reviews-client';

export const dynamic = 'force-dynamic';

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  coerceLocale(raw);
  const data = await fetchReviews();
  return <ReviewsClient data={data} />;
}
