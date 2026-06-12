import { describe, it, expect } from 'vitest';
import { leastLoaded, planAssignments } from '../dispatch-assign';

describe('leastLoaded', () => {
  it('returns null for an empty pool', () => {
    expect(leastLoaded([], new Map())).toBeNull();
  });
  it('picks the member with the lowest load', () => {
    const load = new Map([['a', 3], ['b', 1], ['c', 2]]);
    expect(leastLoaded(['a', 'b', 'c'], load)).toBe('b');
  });
  it('treats missing load as zero', () => {
    const load = new Map([['a', 1]]);
    expect(leastLoaded(['a', 'b'], load)).toBe('b');
  });
});

describe('planAssignments', () => {
  it('routes deliveries to drivers and installations to technicians', () => {
    const plan = planAssignments(
      [
        { id: 't1', type: 'delivery' },
        { id: 't2', type: 'installation' },
      ],
      ['d1'],
      ['x1'],
    );
    expect(plan).toEqual([
      { taskId: 't1', assigneeId: 'd1' },
      { taskId: 't2', assigneeId: 'x1' },
    ]);
  });

  it('spreads work evenly as it assigns (round-robins by load)', () => {
    const plan = planAssignments(
      [
        { id: 't1', type: 'delivery' },
        { id: 't2', type: 'delivery' },
        { id: 't3', type: 'delivery' },
        { id: 't4', type: 'delivery' },
      ],
      ['d1', 'd2'],
      [],
    );
    const counts = plan.reduce<Record<string, number>>((acc, p) => {
      acc[p.assigneeId] = (acc[p.assigneeId] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ d1: 2, d2: 2 });
  });

  it('respects pre-existing load', () => {
    const plan = planAssignments(
      [{ id: 't1', type: 'delivery' }],
      ['busy', 'free'],
      [],
      new Map([['busy', 5]]),
    );
    expect(plan[0]?.assigneeId).toBe('free');
  });

  it('skips tasks with no eligible pool', () => {
    const plan = planAssignments([{ id: 't1', type: 'installation' }], ['d1'], []);
    expect(plan).toEqual([]);
  });
});
