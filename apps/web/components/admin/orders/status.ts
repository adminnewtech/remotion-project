/**
 * Order-status presentation: Arabic labels, StatusPill tones, channel labels,
 * and the filter-chip groups for the gold orders list.
 */
import type { OrderStatus } from '@elite/types';
import type { StatusTone } from '@elite/ui/web';
import type { OrderChannel } from '@/lib/admin-orders-sample';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: 'مسودة',
  pending_payment: 'بانتظار الدفع',
  paid: 'مدفوع',
  processing: 'قيد التجهيز',
  out_for_delivery: 'قيد التوصيل',
  delivered: 'تم التوصيل',
  installing: 'قيد التركيب',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  refunded: 'مُسترد',
};

export const STATUS_TONE: Record<OrderStatus, StatusTone> = {
  draft: 'neutral',
  pending_payment: 'late',
  paid: 'new',
  processing: 'prep',
  out_for_delivery: 'prep',
  delivered: 'done',
  installing: 'brand',
  completed: 'done',
  cancelled: 'neutral',
  refunded: 'late',
};

export const CHANNEL_LABEL: Record<OrderChannel, string> = {
  store: 'المتجر',
  pos: 'الكاشير',
  whatsapp: 'واتساب',
  workshop: 'الورشة',
};

/** Status changer flow (next-status picker in the detail view). */
export const STATUS_FLOW: OrderStatus[] = [
  'pending_payment',
  'paid',
  'processing',
  'out_for_delivery',
  'delivered',
  'installing',
  'completed',
  'cancelled',
  'refunded',
];

/** Filter chips: each maps to a set of statuses (الكل = all). */
export interface FilterChip {
  key: string;
  label: string;
  match: (s: OrderStatus) => boolean;
}

export const FILTER_CHIPS: FilterChip[] = [
  { key: 'all', label: 'الكل', match: () => true },
  { key: 'paid', label: 'مدفوع', match: (s) => s === 'paid' },
  { key: 'processing', label: 'قيد التجهيز', match: (s) => s === 'processing' },
  { key: 'out_for_delivery', label: 'قيد التوصيل', match: (s) => s === 'out_for_delivery' },
  { key: 'installing', label: 'قيد التركيب', match: (s) => s === 'installing' },
  { key: 'completed', label: 'مكتمل', match: (s) => s === 'completed' || s === 'delivered' },
  { key: 'cancelled', label: 'ملغي', match: (s) => s === 'cancelled' || s === 'refunded' },
];
