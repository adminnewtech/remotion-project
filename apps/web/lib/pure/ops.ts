/**
 * Pure ops logic (unit-tested, no IO): SLA lateness, loyalty math, and the
 * order-channel mapping shared by orders list + analytics.
 */
import type { TaskStatus } from '@elite/types';

const DONE: TaskStatus[] = ['completed', 'failed', 'cancelled'];

/** A task is late when its window has closed and it isn't finished. */
export function isLate(windowEnd: string | null, status: TaskStatus, now: number = Date.now()): boolean {
  if (!windowEnd) return false;
  if (DONE.includes(status)) return false;
  return new Date(windowEnd).getTime() < now;
}

/** Loyalty: 1 point per whole KWD of the completed order (mirrors the trigger). */
export function pointsFor(total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.floor(total);
}

export type SalesChannel = 'online' | 'pos' | 'whatsapp' | 'workshop';

export const CHANNEL_AR: Record<SalesChannel, string> = {
  online: 'المتجر الإلكتروني',
  pos: 'الكاشير (المعرض)',
  whatsapp: 'واتساب',
  workshop: 'الورشة',
};

/** Normalize a stored channel value; unknown/legacy → 'online'. */
export function normalizeChannel(value: string | null | undefined): SalesChannel {
  return value === 'pos' || value === 'whatsapp' || value === 'workshop' ? value : 'online';
}
