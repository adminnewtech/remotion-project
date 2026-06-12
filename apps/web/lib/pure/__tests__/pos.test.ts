import { describe, it, expect } from 'vitest';
import {
  linesSubtotal,
  discountAmount,
  discountEligible,
  maxRedeemablePoints,
  pointsToKwd,
  cartTotals,
  changeDue,
  tenderCovers,
  expectedCash,
  cashVariance,
  quickCashOptions,
} from '../pos';

describe('linesSubtotal', () => {
  it('sums qty × price in fils', () => {
    expect(linesSubtotal([{ unitPrice: 3.95, qty: 2 }, { unitPrice: 12.75, qty: 1 }])).toBe(20.65);
  });
  it('ignores negative qty', () => {
    expect(linesSubtotal([{ unitPrice: 5, qty: -3 }])).toBe(0);
  });
});

describe('discountAmount', () => {
  it('percent of subtotal', () => {
    expect(discountAmount(100, 'percent', 10)).toBe(10);
    expect(discountAmount(33.333, 'percent', 15)).toBe(5);
  });
  it('flat amount capped at subtotal', () => {
    expect(discountAmount(20, 'amount', 5)).toBe(5);
    expect(discountAmount(3, 'amount', 5)).toBe(3);
  });
  it('percent capped at subtotal', () => {
    expect(discountAmount(10, 'percent', 150)).toBe(10);
  });
  it('free_delivery has no in-store effect', () => {
    expect(discountAmount(50, 'free_delivery', 2)).toBe(0);
  });
  it('zero on empty/invalid', () => {
    expect(discountAmount(0, 'percent', 10)).toBe(0);
    expect(discountAmount(50, 'amount', 0)).toBe(0);
  });
});

describe('discountEligible', () => {
  const base = { isActive: true, minSubtotal: 0, subtotal: 50, now: 1_000_000 };
  it('active + meets minimum', () => {
    expect(discountEligible(base)).toBe(true);
  });
  it('rejects inactive', () => {
    expect(discountEligible({ ...base, isActive: false })).toBe(false);
  });
  it('rejects below minimum', () => {
    expect(discountEligible({ ...base, minSubtotal: 100 })).toBe(false);
  });
  it('respects window', () => {
    expect(discountEligible({ ...base, startsAt: new Date(2_000_000).toISOString() })).toBe(false);
    expect(discountEligible({ ...base, endsAt: new Date(500_000).toISOString() })).toBe(false);
  });
  it('respects usage limit', () => {
    expect(discountEligible({ ...base, usageLimit: 5, usedCount: 5 })).toBe(false);
    expect(discountEligible({ ...base, usageLimit: 5, usedCount: 4 })).toBe(true);
  });
});

describe('loyalty', () => {
  it('only whole 100-point blocks, capped by bill and balance', () => {
    expect(maxRedeemablePoints(550, 3)).toBe(300); // bill 3 KWD = 300 pts; balance 550 → 300
    expect(maxRedeemablePoints(250, 10)).toBe(200); // balance 250 → 200 usable
    expect(maxRedeemablePoints(50, 10)).toBe(0);    // < 100 pts
  });
  it('converts points to KWD', () => {
    expect(pointsToKwd(300)).toBe(3);
    expect(pointsToKwd(0)).toBe(0);
  });
});

describe('cartTotals', () => {
  it('applies discount then loyalty, floored at 0', () => {
    const t = cartTotals({
      lines: [{ unitPrice: 50, qty: 1 }],
      discountKind: 'percent',
      discountValue: 10,
      redeemPoints: 500,
    });
    expect(t.subtotal).toBe(50);
    expect(t.discountTotal).toBe(5);     // 10% of 50
    expect(t.loyaltyValue).toBe(5);      // 500 pts = 5 KWD
    expect(t.total).toBe(40);            // 50 − 5 − 5
  });
  it('no discount/loyalty → subtotal', () => {
    const t = cartTotals({ lines: [{ unitPrice: 12.5, qty: 2 }] });
    expect(t.total).toBe(25);
    expect(t.discountTotal).toBe(0);
  });
  it('loyalty cannot exceed the bill', () => {
    const t = cartTotals({ lines: [{ unitPrice: 2, qty: 1 }], redeemPoints: 100000 });
    expect(t.total).toBe(0);
    expect(t.loyaltyValue).toBe(2);
  });
});

describe('tendering', () => {
  it('change due never negative', () => {
    expect(changeDue(7.5, 10)).toBe(2.5);
    expect(changeDue(7.5, 5)).toBe(0);
  });
  it('tenderCovers compares in fils', () => {
    expect(tenderCovers(7.5, 7.5)).toBe(true);
    expect(tenderCovers(7.5, 7.499)).toBe(false);
  });
});

describe('shift reconciliation', () => {
  it('expected cash = float + sales + payin − payout − drop', () => {
    expect(expectedCash({ openingFloat: 20, cashSales: 130.5, payIns: 5, payOuts: 10, drops: 50 })).toBe(95.5);
  });
  it('variance counted − expected', () => {
    expect(cashVariance(96, 95.5)).toBe(0.5);
    expect(cashVariance(94, 95.5)).toBe(-1.5);
  });
});

describe('quickCashOptions', () => {
  it('includes exact + next note denominations', () => {
    const opts = quickCashOptions(7.5);
    expect(opts).toContain(7.5);
    expect(opts).toContain(10);
    expect(opts[0]).toBe(7.5);
  });
  it('empty for zero', () => {
    expect(quickCashOptions(0)).toEqual([]);
  });
});
