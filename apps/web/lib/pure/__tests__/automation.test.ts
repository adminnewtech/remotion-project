import { describe, it, expect } from 'vitest';
import { matchesConditions } from '../automation';

describe('matchesConditions', () => {
  it('empty conditions match everything', () => {
    expect(matchesConditions({ to_status: 'paid' }, {})).toBe(true);
  });
  it('matches exact values', () => {
    expect(matchesConditions({ to_status: 'paid' }, { to_status: 'paid' })).toBe(true);
    expect(matchesConditions({ to_status: 'draft' }, { to_status: 'paid' })).toBe(false);
  });
  it('ignores empty/undefined condition values', () => {
    expect(matchesConditions({ to_status: 'paid' }, { to_status: '' })).toBe(true);
  });
  it('all keys must match', () => {
    expect(matchesConditions({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
    expect(matchesConditions({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });
});
