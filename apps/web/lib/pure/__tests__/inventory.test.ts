import { describe, it, expect } from 'vitest';
import { poStatusFromItems, parseSerials, validateReceive, stockValue } from '../inventory';

describe('poStatusFromItems', () => {
  it('stays draft/cancelled regardless of items', () => {
    expect(poStatusFromItems([{ qty_ordered: 5, qty_received: 5 }], 'draft')).toBe('draft');
    expect(poStatusFromItems([{ qty_ordered: 5, qty_received: 5 }], 'cancelled')).toBe('cancelled');
  });
  it('ordered → partial → received as receiving progresses', () => {
    expect(poStatusFromItems([{ qty_ordered: 10, qty_received: 0 }], 'ordered')).toBe('ordered');
    expect(poStatusFromItems([{ qty_ordered: 10, qty_received: 4 }], 'ordered')).toBe('partial');
    expect(poStatusFromItems([{ qty_ordered: 10, qty_received: 10 }], 'partial')).toBe('received');
  });
  it('multi-line: received only when every unit is in', () => {
    expect(
      poStatusFromItems(
        [
          { qty_ordered: 5, qty_received: 5 },
          { qty_ordered: 3, qty_received: 1 },
        ],
        'ordered',
      ),
    ).toBe('partial');
  });
  it('over-receipt is clamped per line, not counted as extra', () => {
    expect(
      poStatusFromItems(
        [
          { qty_ordered: 5, qty_received: 9 },
          { qty_ordered: 5, qty_received: 0 },
        ],
        'ordered',
      ),
    ).toBe('partial');
  });
});

describe('parseSerials', () => {
  it('splits on newlines/commas/semicolons, trims, dedupes', () => {
    expect(parseSerials('SN001\nSN002, SN003; SN001\n  SN004  ')).toEqual([
      'SN001', 'SN002', 'SN003', 'SN004',
    ]);
  });
  it('drops too-short / too-long entries', () => {
    const long = 'x'.repeat(65);
    expect(parseSerials(`ab\nABC123\n${long}`)).toEqual(['ABC123']);
  });
});

describe('validateReceive', () => {
  const line = { qty_ordered: 10, qty_received: 4 };
  it('rejects non-positive / non-integer qty', () => {
    expect(validateReceive(line, 0, null)).toEqual({ ok: false, reason: 'qty' });
    expect(validateReceive(line, 1.5, null)).toEqual({ ok: false, reason: 'qty' });
  });
  it('rejects receiving past the ordered qty', () => {
    expect(validateReceive(line, 7, null)).toEqual({ ok: false, reason: 'over' });
  });
  it('requires serial count to match qty when serials provided', () => {
    expect(validateReceive(line, 3, 2)).toEqual({ ok: false, reason: 'serials' });
    expect(validateReceive(line, 3, 3)).toEqual({ ok: true });
  });
  it('accepts a valid receive without serials', () => {
    expect(validateReceive(line, 6, null)).toEqual({ ok: true });
  });
});

describe('stockValue', () => {
  it('sums on-hand × cost in fils', () => {
    expect(stockValue([
      { onHand: 3, cost: 12.5 },
      { onHand: 2, cost: 0.275 },
    ])).toBe(38.05);
  });
});
