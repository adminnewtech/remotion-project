import { describe, it, expect } from 'vitest';
import { eventsToTimeline, deriveTimeline, type OrderEventRow } from '../order-timeline';

const ev = (to: string, at: string, from: string | null = null): OrderEventRow => ({
  kind: from ? 'status_changed' : 'placed',
  from_status: from as OrderEventRow['from_status'],
  to_status: to as OrderEventRow['to_status'],
  note: null,
  created_at: at,
});

describe('eventsToTimeline (real audit trail)', () => {
  it('stamps steps with the actual event times', () => {
    const events = [
      ev('paid', '2026-06-10T10:00:00Z'),
      ev('processing', '2026-06-10T12:00:00Z', 'paid'),
      ev('out_for_delivery', '2026-06-11T09:00:00Z', 'processing'),
    ];
    const tl = eventsToTimeline(events, 'out_for_delivery');
    expect(tl.find((s) => s.key === 'paid')?.at).toBe('2026-06-10T10:00:00Z');
    expect(tl.find((s) => s.key === 'processing')?.at).toBe('2026-06-10T12:00:00Z');
    expect(tl.find((s) => s.key === 'out_for_delivery')?.done).toBe(true);
    expect(tl.find((s) => s.key === 'completed')?.done).toBe(false);
    expect(tl.find((s) => s.key === 'completed')?.at).toBeNull();
  });

  it('keeps the first time a status was reached (immutable trail)', () => {
    const events = [
      ev('paid', '2026-06-10T10:00:00Z'),
      ev('paid', '2026-06-12T10:00:00Z', 'processing'), // weird back-transition
    ];
    const tl = eventsToTimeline(events, 'paid');
    expect(tl.find((s) => s.key === 'paid')?.at).toBe('2026-06-10T10:00:00Z');
  });

  it('marks steps done from current status even without events (legacy orders)', () => {
    const tl = eventsToTimeline([], 'installing');
    expect(tl.find((s) => s.key === 'paid')?.done).toBe(true);
    expect(tl.find((s) => s.key === 'installing')?.done).toBe(true);
    expect(tl.find((s) => s.key === 'completed')?.done).toBe(false);
  });
});

describe('deriveTimeline (synthetic fallback)', () => {
  it('marks all steps up to current status done with synthetic times', () => {
    const tl = deriveTimeline('out_for_delivery', '2026-06-10T08:00:00Z');
    expect(tl.filter((s) => s.done).map((s) => s.key)).toEqual(['paid', 'processing', 'out_for_delivery']);
    expect(tl.find((s) => s.key === 'paid')?.at).not.toBeNull();
    expect(tl.find((s) => s.key === 'completed')?.at).toBeNull();
  });

  it('cancelled order has no flow steps done beyond none', () => {
    const tl = deriveTimeline('draft', '2026-06-10T08:00:00Z');
    expect(tl.every((s) => !s.done)).toBe(true);
  });
});
