/**
 * Pure KWD money + ticket math (unit-tested, no IO).
 * KWD has 3 decimal places (fils); all arithmetic must round to avoid drift.
 */
export const round3 = (n: number): number => Math.round((n + Number.EPSILON) * 1000) / 1000;

export interface TicketLine {
  unitPrice: number;
  qty: number;
}

/** Sum of line totals, rounded to fils. */
export function ticketTotal(lines: TicketLine[]): number {
  return round3(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
}

/** Resolve the delivery fee: free above threshold, else the zone/default fee. */
export function deliveryFee(subtotal: number, freeThreshold: number, zoneFee: number): number {
  if (subtotal >= freeThreshold) return 0;
  return round3(zoneFee);
}
