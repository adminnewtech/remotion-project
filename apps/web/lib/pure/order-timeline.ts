/**
 * Pure order-timeline logic (unit-tested, no IO).
 *
 * `eventsToTimeline` renders the REAL audit trail from `order_events` rows;
 * `deriveTimeline` is the legacy synthetic fallback for orders that predate
 * migration 0018 (or sample mode). Both return the same view shape.
 */
import type { OrderStatus } from '@elite/types';

export interface TimelineStep {
  key: OrderStatus;
  label: string;
  at: string | null;
  done: boolean;
}

export interface OrderEventRow {
  kind: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus | null;
  note: string | null;
  created_at: string;
}

export const STATUS_LABEL_AR: Record<OrderStatus, string> = {
  draft: 'مسودة',
  pending_payment: 'بانتظار الدفع',
  paid: 'تم الدفع',
  processing: 'قيد التجهيز',
  out_for_delivery: 'قيد التوصيل',
  delivered: 'تم التوصيل',
  installing: 'قيد التركيب',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  refunded: 'مسترجع',
};

const FLOW: OrderStatus[] = ['paid', 'processing', 'out_for_delivery', 'installing', 'completed'];
const ORDER: OrderStatus[] = [
  'draft', 'pending_payment', 'paid', 'processing',
  'out_for_delivery', 'delivered', 'installing', 'completed',
];

/**
 * Build the stepper from REAL events: each flow step is done iff an event
 * reached (or passed) it, stamped with the actual event time.
 */
export function eventsToTimeline(events: OrderEventRow[], currentStatus: OrderStatus): TimelineStep[] {
  const reachedAt = new Map<OrderStatus, string>();
  for (const e of events) {
    if (e.to_status && !reachedAt.has(e.to_status)) reachedAt.set(e.to_status, e.created_at);
  }
  const currentIdx = ORDER.indexOf(currentStatus);
  return FLOW.map((key) => {
    const at = reachedAt.get(key) ?? null;
    const done = at !== null || (currentIdx >= ORDER.indexOf(key) && currentIdx >= 0);
    return { key, label: STATUS_LABEL_AR[key], at, done };
  });
}

/** Synthetic fallback — derives plausible timestamps from placedAt. */
export function deriveTimeline(status: OrderStatus, placedAt: string): TimelineStep[] {
  const currentIdx = ORDER.indexOf(status);
  const base = new Date(placedAt).getTime();
  return FLOW.map((key, i) => {
    const done = currentIdx >= ORDER.indexOf(key);
    return {
      key,
      label: STATUS_LABEL_AR[key],
      at: done ? new Date(base + i * 2 * 3_600_000).toISOString() : null,
      done,
    };
  });
}
