import { describe, it, expect } from 'vitest';
import { isBalanced, netProfit } from '../accounting';

describe('isBalanced (double-entry)', () => {
  it('accepts a balanced 2-line entry', () => {
    expect(isBalanced([
      { account: '1010', debit: 12.5, credit: 0 },
      { account: '4000', debit: 0, credit: 12.5 },
    ])).toBe(true);
  });
  it('rejects unbalanced totals', () => {
    expect(isBalanced([
      { account: '1010', debit: 12.5, credit: 0 },
      { account: '4000', debit: 0, credit: 12.4 },
    ])).toBe(false);
  });
  it('rejects a line with both sides set', () => {
    expect(isBalanced([
      { account: '1010', debit: 5, credit: 5 },
      { account: '4000', debit: 0, credit: 0 },
    ])).toBe(false);
  });
  it('rejects negatives, single lines, and zero entries', () => {
    expect(isBalanced([{ account: '1000', debit: 1, credit: 0 }])).toBe(false);
    expect(isBalanced([
      { account: '1000', debit: -1, credit: 0 },
      { account: '4000', debit: 0, credit: -1 },
    ])).toBe(false);
    expect(isBalanced([
      { account: '1000', debit: 0, credit: 0 },
      { account: '4000', debit: 0, credit: 0 },
    ])).toBe(false);
  });
  it('handles fils float drift (0.1+0.2)', () => {
    expect(isBalanced([
      { account: '1000', debit: 0.1, credit: 0 },
      { account: '1010', debit: 0.2, credit: 0 },
      { account: '4000', debit: 0, credit: 0.3 },
    ])).toBe(true);
  });
});

describe('netProfit', () => {
  it('revenue − expense, in fils', () => {
    expect(netProfit([
      { kind: 'revenue', amount: 100.5 },
      { kind: 'expense', amount: 40.25 },
      { kind: 'expense', amount: 10 },
    ])).toBe(50.25);
  });
  it('loss is negative', () => {
    expect(netProfit([
      { kind: 'revenue', amount: 5 },
      { kind: 'expense', amount: 9.999 },
    ])).toBe(-4.999);
  });
});
