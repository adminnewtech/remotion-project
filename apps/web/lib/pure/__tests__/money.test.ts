import { describe, it, expect } from 'vitest';
import { round3, ticketTotal, deliveryFee, fulfillmentDeliveryFee } from '../money';

describe('round3 (KWD fils)', () => {
  it('rounds to 3 decimals', () => {
    expect(round3(1.2345)).toBe(1.235);
    expect(round3(1.2344)).toBe(1.234);
  });
  it('avoids float drift', () => {
    expect(round3(0.1 + 0.2)).toBe(0.3);
  });
});

describe('ticketTotal', () => {
  it('sums qty × unitPrice in fils', () => {
    expect(ticketTotal([
      { unitPrice: 3.95, qty: 2 },
      { unitPrice: 12.75, qty: 1 },
    ])).toBe(20.65);
  });
  it('empty ticket is zero', () => {
    expect(ticketTotal([])).toBe(0);
  });
});

describe('deliveryFee', () => {
  it('free at/above threshold', () => {
    expect(deliveryFee(10, 10, 2)).toBe(0);
    expect(deliveryFee(15, 10, 2)).toBe(0);
  });
  it('zone fee below threshold', () => {
    expect(deliveryFee(9.999, 10, 2.5)).toBe(2.5);
  });
});

describe('fulfillmentDeliveryFee', () => {
  it('pickup is always free, regardless of subtotal', () => {
    expect(fulfillmentDeliveryFee('pickup', 0, 10, 1.5)).toBe(0);
    expect(fulfillmentDeliveryFee('pickup', 5, 10, 1.5)).toBe(0);
    expect(fulfillmentDeliveryFee('pickup', 50, 10, 1.5)).toBe(0);
  });
  it('delivery falls back to threshold/zone logic', () => {
    expect(fulfillmentDeliveryFee('delivery', 9.999, 10, 1.5)).toBe(1.5);
    expect(fulfillmentDeliveryFee('delivery', 10, 10, 1.5)).toBe(0);
  });
});
