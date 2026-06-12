import { coerceLocale } from '@/lib/i18n';
import { fetchApprovals } from '@/lib/admin-approvals';
import { ApprovalsClient } from './approvals-client';

// Always render fresh — pending approvals must be current.
export const dynamic = 'force-dynamic';

export default async function ApprovalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  coerceLocale(raw);
  const data = await fetchApprovals();
  return <ApprovalsClient data={data} />;
}
