/**
 * Pure inventory/purchasing logic (unit-tested, no IO).
 */

export type PoStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';

export interface PoItemProgress {
  qty_ordered: number;
  qty_received: number;
}

/** Derive a PO's status from its items' receive progress. */
export function poStatusFromItems(items: PoItemProgress[], current: PoStatus): PoStatus {
  if (current === 'draft' || current === 'cancelled') return current;
  if (!items.length) return current;
  const ordered = items.reduce((s, i) => s + i.qty_ordered, 0);
  const received = items.reduce((s, i) => s + Math.min(i.qty_received, i.qty_ordered), 0);
  if (received <= 0) return 'ordered';
  if (received < ordered) return 'partial';
  return 'received';
}

/** Parse pasted serial numbers (one per line / comma separated), dedupe, trim. */
export function parseSerials(raw: string, max = 500): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 3 && s.length <= 64),
    ),
  ).slice(0, max);
}

/**
 * Validate a receive request against the PO line: you can never receive more
 * than remaining; serial count (when provided) must equal the received qty.
 */
export function validateReceive(
  line: PoItemProgress,
  qty: number,
  serialCount: number | null,
): { ok: true } | { ok: false; reason: 'qty' | 'over' | 'serials' } {
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, reason: 'qty' };
  if (line.qty_received + qty > line.qty_ordered) return { ok: false, reason: 'over' };
  if (serialCount !== null && serialCount !== qty) return { ok: false, reason: 'serials' };
  return { ok: true };
}

/** Stock valuation: Σ on_hand × unit cost (fallback price), rounded to fils. */
export function stockValue(rows: { onHand: number; cost: number }[]): number {
  return Math.round(rows.reduce((s, r) => s + r.onHand * r.cost, 0) * 1000) / 1000;
}
