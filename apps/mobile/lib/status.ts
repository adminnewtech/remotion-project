/**
 * Status → color + i18n-key mapping for order and task statuses.
 *
 * `@elite/ui` is expected to ship status color helpers too, but those are
 * web-tuned (CSS classes); on mobile we resolve directly to palette hex
 * values. Translation keys point at the `orderStatus.*` / `taskStatus.*`
 * dictionaries in `@elite/i18n`.
 */
import type { OrderStatus, TaskStatus } from '@elite/types';
import { palette } from './palette';

export type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'accent';

const TONE_COLORS: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: palette.neutral700, bg: palette.neutral100 },
  info: { fg: palette.info, bg: palette.infoBg },
  warning: { fg: palette.warning, bg: palette.warningBg },
  success: { fg: palette.success, bg: palette.successBg },
  danger: { fg: palette.danger, bg: palette.dangerBg },
  accent: { fg: palette.accent, bg: palette.accentLight },
};

export function toneColors(tone: Tone) {
  return TONE_COLORS[tone];
}

const ORDER_TONE: Record<OrderStatus, Tone> = {
  draft: 'neutral',
  pending_payment: 'warning',
  paid: 'info',
  processing: 'info',
  out_for_delivery: 'accent',
  delivered: 'success',
  installing: 'accent',
  completed: 'success',
  cancelled: 'danger',
  refunded: 'danger',
};

const TASK_TONE: Record<TaskStatus, Tone> = {
  unassigned: 'neutral',
  assigned: 'info',
  accepted: 'info',
  en_route: 'accent',
  arrived: 'accent',
  in_progress: 'warning',
  completed: 'success',
  failed: 'danger',
  cancelled: 'danger',
};

export function orderStatusTone(status: OrderStatus): Tone {
  return ORDER_TONE[status] ?? 'neutral';
}

export function taskStatusTone(status: TaskStatus): Tone {
  return TASK_TONE[status] ?? 'neutral';
}

/** i18n key for an order status label. */
export function orderStatusKey(status: OrderStatus): string {
  return `orderStatus.${status}`;
}

/** i18n key for a task status label. */
export function taskStatusKey(status: TaskStatus): string {
  return `taskStatus.${status}`;
}

/**
 * Ordered milestone sequence for the customer order timeline. Installation
 * statuses are interleaved; the timeline component highlights up to the
 * current status.
 */
export const ORDER_TIMELINE: OrderStatus[] = [
  'paid',
  'processing',
  'out_for_delivery',
  'delivered',
  'installing',
  'completed',
];

/** Ordered field-task lifecycle for the driver/technician progress UI. */
export const TASK_LIFECYCLE: TaskStatus[] = [
  'accepted',
  'en_route',
  'arrived',
  'in_progress',
  'completed',
];
