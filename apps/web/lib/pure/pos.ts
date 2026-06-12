/**
 * Pure POS (cashier) logic — unit-tested, no IO. KWD has 3 decimals (fils).
 *
 * Covers cart discounting, cash tendering/change, loyalty-point redemption, and
 * shift cash reconciliation. The cashier UI and server actions both import these
 * so the math lives in exactly one place.
 */
import { round3 } from './money';

export type DiscountKind = 'percent' | 'amount' | 'free_delivery';

export interface PosLine {
  unitPrice: number;
  qty: number;
}

/** 100 loyalty points = 1.000 KWD. Burn is floored to whole 100s. */
export const LOYALTY_POINTS_PER_KWD = 100;

/** Sum of line totals, rounded to fils. */
export function linesSubtotal(lines: PosLine[]): number {
  return round3(lines.reduce((s, l) => s + l.unitPrice * Math.max(0, l.qty), 0));
}

/**
 * Discount amount (KWD) for a code/manual discount against a subtotal.
 * - percent: value is a percentage (0–100), capped at the subtotal
 * - amount: value is a flat KWD amount, capped at the subtotal
 * - free_delivery: no effect on an in-store sale (no delivery) → 0
 */
export function discountAmount(subtotal: number, kind: DiscountKind, value: number): number {
  if (subtotal <= 0 || value <= 0) return 0;
  if (kind === 'percent') return round3(Math.min(subtotal, subtotal * (value / 100)));
  if (kind === 'amount') return round3(Math.min(subtotal, value));
  return 0; // free_delivery
}

/** Is a discount code valid for this subtotal/time? Mirrors checkout validation. */
export function discountEligible(opts: {
  isActive: boolean;
  minSubtotal: number;
  subtotal: number;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  usedCount?: number;
  now?: number;
}): boolean {
  const now = opts.now ?? Date.now();
  if (!opts.isActive) return false;
  if (opts.subtotal < opts.minSubtotal) return false;
  if (opts.startsAt && new Date(opts.startsAt).getTime() > now) return false;
  if (opts.endsAt && new Date(opts.endsAt).getTime() < now) return false;
  if (opts.usageLimit != null && (opts.usedCount ?? 0) >= opts.usageLimit) return false;
  return true;
}

/** Max points a customer can spend on this sale (can't exceed the balance or the bill). */
export function maxRedeemablePoints(balance: number, billAfterDiscount: number): number {
  if (balance <= 0 || billAfterDiscount <= 0) return 0;
  const billPoints = Math.floor(billAfterDiscount * LOYALTY_POINTS_PER_KWD);
  // Only whole 100-point blocks are spendable (1 KWD granularity).
  const usable = Math.min(balance, billPoints);
  return Math.floor(usable / LOYALTY_POINTS_PER_KWD) * LOYALTY_POINTS_PER_KWD;
}

/** KWD value of redeemed points. */
export function pointsToKwd(points: number): number {
  if (points <= 0) return 0;
  return round3(points / LOYALTY_POINTS_PER_KWD);
}

export interface CartTotals {
  subtotal: number;
  discountTotal: number;   // code/manual discount
  loyaltyValue: number;    // KWD covered by redeemed points
  total: number;           // amount the customer pays (>= 0)
}

/** Compose the full bill: subtotal − discount − loyalty, floored at 0. */
export function cartTotals(opts: {
  lines: PosLine[];
  discountKind?: DiscountKind | null;
  discountValue?: number;
  redeemPoints?: number;
}): CartTotals {
  const subtotal = linesSubtotal(opts.lines);
  const discountTotal =
    opts.discountKind && opts.discountValue
      ? discountAmount(subtotal, opts.discountKind, opts.discountValue)
      : 0;
  const afterDiscount = round3(Math.max(0, subtotal - discountTotal));
  const loyaltyValue = pointsToKwd(
    Math.min(opts.redeemPoints ?? 0, maxRedeemablePoints(Number.MAX_SAFE_INTEGER, afterDiscount)),
  );
  const total = round3(Math.max(0, afterDiscount - loyaltyValue));
  return { subtotal, discountTotal, loyaltyValue, total };
}

/** Change owed to the customer when paying cash. Never negative. */
export function changeDue(total: number, tendered: number): number {
  return round3(Math.max(0, tendered - total));
}

/** Is the tendered cash enough to cover the bill? */
export function tenderCovers(total: number, tendered: number): boolean {
  return round3(tendered) >= round3(total);
}

export interface ShiftCashInputs {
  openingFloat: number;
  cashSales: number;
  payIns: number;
  payOuts: number;
  drops: number;
}

/** Expected cash in the drawer at close = float + cash sales + pay-ins − pay-outs − drops. */
export function expectedCash(i: ShiftCashInputs): number {
  return round3(i.openingFloat + i.cashSales + i.payIns - i.payOuts - i.drops);
}

/** Variance = counted − expected. Positive = over, negative = short. */
export function cashVariance(counted: number, expected: number): number {
  return round3(counted - expected);
}

/** Quick-cash suggestion buttons for a given total (rounded up to common notes). */
export function quickCashOptions(total: number): number[] {
  if (total <= 0) return [];
  const exact = round3(total);
  const notes = [1, 5, 10, 20, 50, 100];
  const out = new Set<number>([exact]);
  // Next whole KWD up
  const nextWhole = Math.ceil(exact);
  if (nextWhole > exact) out.add(nextWhole);
  for (const n of notes) {
    if (n >= exact) out.add(n);
  }
  return Array.from(out).sort((a, b) => a - b).slice(0, 5);
}
