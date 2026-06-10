/**
 * @elite/ui/status — status → presentation mapping for chips/badges.
 *
 * Platform-agnostic: returns a translation key (resolve with `@elite/i18n`),
 * a semantic color token name, and an icon name. Web renders these via
 * <StatusBadge>; mobile can map the same descriptors to RN primitives.
 */
import type { OrderStatus, TaskStatus } from '@elite/types';

/** Semantic color buckets, mapped to token scales in `tokens.ts`. */
export type StatusTone = 'neutral' | 'info' | 'primary' | 'accent' | 'success' | 'warning' | 'danger';

export interface StatusDescriptor {
  /** Dot-path key into the i18n dictionary (e.g. "orderStatus.paid"). */
  labelKey: string;
  /** Semantic color bucket for the chip background/text. */
  tone: StatusTone;
  /** Icon name (lucide-style, framework-agnostic string). */
  icon: string;
}

export const ORDER_STATUS_META: Record<OrderStatus, StatusDescriptor> = {
  draft: { labelKey: 'orderStatus.draft', tone: 'neutral', icon: 'file-pen' },
  pending_payment: { labelKey: 'orderStatus.pending_payment', tone: 'warning', icon: 'clock' },
  paid: { labelKey: 'orderStatus.paid', tone: 'info', icon: 'credit-card' },
  processing: { labelKey: 'orderStatus.processing', tone: 'primary', icon: 'package' },
  out_for_delivery: { labelKey: 'orderStatus.out_for_delivery', tone: 'accent', icon: 'truck' },
  delivered: { labelKey: 'orderStatus.delivered', tone: 'success', icon: 'package-check' },
  installing: { labelKey: 'orderStatus.installing', tone: 'accent', icon: 'wrench' },
  completed: { labelKey: 'orderStatus.completed', tone: 'success', icon: 'circle-check' },
  cancelled: { labelKey: 'orderStatus.cancelled', tone: 'neutral', icon: 'circle-x' },
  refunded: { labelKey: 'orderStatus.refunded', tone: 'danger', icon: 'rotate-ccw' },
};

export const TASK_STATUS_META: Record<TaskStatus, StatusDescriptor> = {
  unassigned: { labelKey: 'taskStatus.unassigned', tone: 'neutral', icon: 'circle-dashed' },
  assigned: { labelKey: 'taskStatus.assigned', tone: 'info', icon: 'user-check' },
  accepted: { labelKey: 'taskStatus.accepted', tone: 'primary', icon: 'check' },
  en_route: { labelKey: 'taskStatus.en_route', tone: 'accent', icon: 'navigation' },
  arrived: { labelKey: 'taskStatus.arrived', tone: 'accent', icon: 'map-pin' },
  in_progress: { labelKey: 'taskStatus.in_progress', tone: 'primary', icon: 'loader' },
  completed: { labelKey: 'taskStatus.completed', tone: 'success', icon: 'circle-check' },
  failed: { labelKey: 'taskStatus.failed', tone: 'danger', icon: 'circle-alert' },
  cancelled: { labelKey: 'taskStatus.cancelled', tone: 'neutral', icon: 'circle-x' },
};

/** Fallback descriptor for unknown/undefined status values (defensive). */
const UNKNOWN_STATUS: StatusDescriptor = { labelKey: 'common.unknown', tone: 'neutral', icon: 'circle-help' };

/** Lookup the descriptor for an order status. Never throws on bad input. */
export function orderStatusMeta(status: OrderStatus | string | null | undefined): StatusDescriptor {
  return (status && ORDER_STATUS_META[status as OrderStatus]) || UNKNOWN_STATUS;
}

/** Lookup the descriptor for a fulfillment task status. Never throws on bad input. */
export function taskStatusMeta(status: TaskStatus | string | null | undefined): StatusDescriptor {
  return (status && TASK_STATUS_META[status as TaskStatus]) || UNKNOWN_STATUS;
}
