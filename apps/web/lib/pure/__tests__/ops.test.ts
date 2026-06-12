import { describe, it, expect } from 'vitest';
import { isLate, pointsFor, normalizeChannel } from '../ops';

const NOW = new Date('2026-06-12T12:00:00Z').getTime();

describe('isLate (SLA)', () => {
  it('late when window passed and task active', () => {
    expect(isLate('2026-06-12T11:00:00Z', 'assigned', NOW)).toBe(true);
    expect(isLate('2026-06-12T11:00:00Z', 'in_progress', NOW)).toBe(true);
  });
  it('not late before the window closes', () => {
    expect(isLate('2026-06-12T13:00:00Z', 'assigned', NOW)).toBe(false);
  });
  it('finished tasks are never late', () => {
    expect(isLate('2026-06-12T11:00:00Z', 'completed', NOW)).toBe(false);
  });
  it('no window → not late', () => {
    expect(isLate(null, 'assigned', NOW)).toBe(false);
  });
});

describe('pointsFor (loyalty)', () => {
  it('1 point per whole KWD', () => {
    expect(pointsFor(264.9)).toBe(264);
    expect(pointsFor(0.9)).toBe(0);
  });
  it('non-positive/invalid → 0', () => {
    expect(pointsFor(0)).toBe(0);
    expect(pointsFor(-5)).toBe(0);
    expect(pointsFor(NaN)).toBe(0);
  });
});

describe('normalizeChannel', () => {
  it('passes known channels through', () => {
    expect(normalizeChannel('pos')).toBe('pos');
    expect(normalizeChannel('whatsapp')).toBe('whatsapp');
  });
  it('legacy/unknown/null → online', () => {
    expect(normalizeChannel(null)).toBe('online');
    expect(normalizeChannel('store')).toBe('online');
  });
});
