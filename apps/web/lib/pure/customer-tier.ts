/**
 * Pure RFM-style customer tier classifier (unit-tested, no IO).
 * Used by the Customer-360 profile.
 */
export type CustomerTier = 'champion' | 'loyal' | 'active' | 'at_risk' | 'new';

const DAY = 86_400_000;

export function tierOf(
  orders: number,
  spent: number,
  lastOrderAt: string | null,
  now: number = Date.now(),
): CustomerTier {
  if (orders === 0) return 'new';
  const days = lastOrderAt ? (now - new Date(lastOrderAt).getTime()) / DAY : Number.POSITIVE_INFINITY;
  if (days > 120) return 'at_risk';
  if (orders >= 5 && spent >= 500) return 'champion';
  if (orders >= 2) return 'loyal';
  return 'active';
}
