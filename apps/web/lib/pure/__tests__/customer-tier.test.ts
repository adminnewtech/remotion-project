import { describe, it, expect } from 'vitest';
import { tierOf } from '../customer-tier';

const NOW = new Date('2026-06-12T00:00:00Z').getTime();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

describe('tierOf (RFM-style classifier)', () => {
  it('no orders → new', () => {
    expect(tierOf(0, 0, null, NOW)).toBe('new');
  });
  it('recent big spender → champion', () => {
    expect(tierOf(7, 1264.5, daysAgo(4), NOW)).toBe('champion');
  });
  it('repeat but modest → loyal', () => {
    expect(tierOf(3, 120, daysAgo(10), NOW)).toBe('loyal');
  });
  it('single recent order → active', () => {
    expect(tierOf(1, 80, daysAgo(5), NOW)).toBe('active');
  });
  it('lapsed >120 days → at_risk regardless of spend', () => {
    expect(tierOf(10, 5000, daysAgo(121), NOW)).toBe('at_risk');
  });
  it('orders but unknown last date → at_risk (assume lapsed)', () => {
    expect(tierOf(2, 100, null, NOW)).toBe('at_risk');
  });
  it('boundary: exactly 120 days is still not at_risk', () => {
    expect(tierOf(5, 600, daysAgo(120), NOW)).toBe('champion');
  });
});
