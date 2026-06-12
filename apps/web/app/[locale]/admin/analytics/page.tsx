import { coerceLocale } from '@/lib/i18n';
import { fetchAnalytics, type RangeKey } from '@/lib/admin-analytics';
import { AnalyticsView } from '@/components/admin/analytics/analytics-view';

// Role-gated, live data — render per request.
export const dynamic = 'force-dynamic';

const RANGES: RangeKey[] = ['today', '7d', '30d', 'year'];
function coerceRange(value: string | undefined): RangeKey {
  return RANGES.includes(value as RangeKey) ? (value as RangeKey) : '30d';
}

/** OSALPHA gold analytics — KPIs, sales chart, channel donut, regions, more. */
export default async function AdminAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { locale: raw } = await params;
  coerceLocale(raw);
  const { range } = await searchParams;

  const data = await fetchAnalytics(coerceRange(range));
  return <AnalyticsView data={data} />;
}
