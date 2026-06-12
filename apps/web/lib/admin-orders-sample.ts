/**
 * OSALPHA admin-orders sample data — realistic Newtech-Kuwait content (no Lorem
 * Ipsum) used when the live Supabase client/env is absent or a live read is
 * empty, so the orders list + detail always render. Money is KWD (3 decimals).
 */
import type { OrderStatus } from '@elite/types';

export type OrderChannel = 'store' | 'pos' | 'whatsapp' | 'workshop';

/** Flattened orders-list row for the gold DataTable. */
export interface AdminOrderRow {
  id: string;
  /** Display order number, e.g. `#8424`. */
  number: string;
  customer: string;
  channel: OrderChannel;
  /** Item count (for the المنتجات column). */
  items: number;
  /** Short products label. */
  itemsLabel: string;
  total: number;
  status: OrderStatus;
  /** Payment-method chip label. */
  pay: string;
  placedAt: string;
}

export interface AdminOrderItemRow {
  id: string;
  name: string;
  sku: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  withInstallation: boolean;
}

export interface AdminOrderDetail {
  id: string;
  number: string;
  customer: string;
  phone: string;
  channel: OrderChannel;
  status: OrderStatus;
  pay: string;
  address: {
    governorate: string;
    area: string;
    block: string;
    street: string;
    building: string;
  };
  items: AdminOrderItemRow[];
  subtotal: number;
  deliveryFee: number;
  installationFee: number;
  discountTotal: number;
  total: number;
  placedAt: string;
  deliverySlot: string | null;
  notes: string | null;
  /** Ops tags (migration 0018). Optional for sample rows. */
  tags?: string[];
  /** Latest internal ops note (migration 0018). */
  internalNote?: string | null;
  timeline: { key: OrderStatus; label: string; at: string | null; done: boolean }[];
}

const today = (h: number) => {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};
const daysAgo = (n: number, h = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

export const sampleAdminOrders: AdminOrderRow[] = [
  { id: 'o-8424', number: '#8424', customer: 'عبدالله العنزي', channel: 'store', items: 2, itemsLabel: 'داش كام + قفل ذكي', total: 64.5, status: 'paid', pay: 'KNET', placedAt: today(9) },
  { id: 'o-8423', number: '#8423', customer: 'سارة المطيري', channel: 'whatsapp', items: 1, itemsLabel: 'حماية PPF كاملة', total: 129.0, status: 'processing', pay: 'رابط دفع', placedAt: today(10) },
  { id: 'o-8422', number: '#8422', customer: 'فهد الديحاني', channel: 'pos', items: 3, itemsLabel: 'إكسسوارات سيارة', total: 38.75, status: 'completed', pay: 'كاش', placedAt: today(11) },
  { id: 'o-8421', number: '#8421', customer: 'نورة العجمي', channel: 'store', items: 4, itemsLabel: 'بروجكتر + ملحقات', total: 216.0, status: 'out_for_delivery', pay: 'تابي ×4', placedAt: today(8) },
  { id: 'o-8420', number: '#8420', customer: 'يوسف الكندري', channel: 'store', items: 1, itemsLabel: 'قفل ذكي S630', total: 54.5, status: 'installing', pay: 'COD', placedAt: today(7) },
  { id: 'o-8419', number: '#8419', customer: 'منيرة الرشيد', channel: 'workshop', items: 1, itemsLabel: 'تظليل حراري 70%', total: 95.0, status: 'installing', pay: 'تابي ×4', placedAt: daysAgo(1, 14) },
  { id: 'o-8418', number: '#8418', customer: 'حمد الصباح', channel: 'store', items: 2, itemsLabel: 'سماعة + شاحن', total: 142.25, status: 'out_for_delivery', pay: 'KNET', placedAt: daysAgo(1, 9) },
  { id: 'o-8417', number: '#8417', customer: 'دلال الفهد', channel: 'whatsapp', items: 1, itemsLabel: 'كاميرا مراقبة', total: 78.0, status: 'paid', pay: 'رابط دفع', placedAt: daysAgo(1, 16) },
  { id: 'o-8416', number: '#8416', customer: 'بدر العتيبي', channel: 'pos', items: 5, itemsLabel: 'حزمة سمارت هوم', total: 311.5, status: 'completed', pay: 'كاش', placedAt: daysAgo(2, 12) },
  { id: 'o-8415', number: '#8415', customer: 'لطيفة المضف', channel: 'store', items: 1, itemsLabel: 'بروجكتر فريستايل', total: 189.0, status: 'cancelled', pay: 'KNET', placedAt: daysAgo(2, 18) },
  { id: 'o-8414', number: '#8414', customer: 'أحمد الخالد', channel: 'workshop', items: 1, itemsLabel: 'نانو سيراميك', total: 220.0, status: 'completed', pay: 'تابي ×4', placedAt: daysAgo(3, 11) },
  { id: 'o-8413', number: '#8413', customer: 'هيا الجسار', channel: 'store', items: 3, itemsLabel: 'إضاءة ذكية', total: 67.75, status: 'processing', pay: 'Apple Pay', placedAt: daysAgo(3, 15) },
];

const ITEMS: Record<string, AdminOrderItemRow[]> = {
  'o-8424': [
    { id: 'i1', name: 'داش كام أزدوم PG17 Max', sku: 'PG17-MAX', qty: 1, unitPrice: 39.5, lineTotal: 39.5, withInstallation: false },
    { id: 'i2', name: 'قفل ذكي S630', sku: 'S630', qty: 1, unitPrice: 25.0, lineTotal: 25.0, withInstallation: false },
  ],
  'o-8421': [
    { id: 'i3', name: 'بروجكتر سامسونج فريستايل', sku: 'SAM-FS', qty: 1, unitPrice: 189.0, lineTotal: 189.0, withInstallation: true },
    { id: 'i4', name: 'شاشة عرض محمولة 100"', sku: 'SCR-100', qty: 1, unitPrice: 27.0, lineTotal: 27.0, withInstallation: false },
  ],
};

export function sampleAdminOrderDetail(id: string): AdminOrderDetail | null {
  const row = sampleAdminOrders.find((r) => r.id === id) ?? sampleAdminOrders[0];
  if (!row) return null;
  const items = ITEMS[row.id] ?? [
    { id: `${row.id}-i1`, name: row.itemsLabel, sku: null, qty: row.items, unitPrice: row.total, lineTotal: row.total, withInstallation: false },
  ];
  const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
  const installationFee = items.some((it) => it.withInstallation) ? 15 : 0;
  const deliveryFee = row.channel === 'pos' ? 0 : 1.5;
  return {
    id: row.id,
    number: row.number,
    customer: row.customer,
    phone: '+965 9012 3456',
    channel: row.channel,
    status: row.status,
    pay: row.pay,
    address: { governorate: 'حولي', area: 'السالمية', block: '12', street: 'شارع سالم المبارك', building: '7' },
    items,
    subtotal,
    deliveryFee,
    installationFee,
    discountTotal: 0,
    total: subtotal + deliveryFee + installationFee,
    placedAt: row.placedAt,
    deliverySlot: today(16),
    notes: null,
    timeline: timelineFor(row.status, row.placedAt),
  };
}

/**
 * Build a detail record directly from a list row (no extra backend round-trip)
 * for the list drawer. The standalone `/orders/[id]` page does the full live
 * fetch with real line items.
 */
export function deriveDetailFromRow(row: AdminOrderRow): AdminOrderDetail {
  const items = ITEMS[row.id] ?? [
    { id: `${row.id}-i1`, name: row.itemsLabel, sku: null, qty: row.items, unitPrice: row.total, lineTotal: row.total, withInstallation: false },
  ];
  const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
  const installationFee = items.some((it) => it.withInstallation) ? 15 : 0;
  const deliveryFee = row.channel === 'pos' ? 0 : 1.5;
  return {
    id: row.id,
    number: row.number,
    customer: row.customer,
    phone: '+965 9012 3456',
    channel: row.channel,
    status: row.status,
    pay: row.pay,
    address: { governorate: 'حولي', area: 'السالمية', block: '12', street: 'شارع سالم المبارك', building: '7' },
    items,
    subtotal,
    deliveryFee,
    installationFee,
    discountTotal: 0,
    total: subtotal + deliveryFee + installationFee,
    placedAt: row.placedAt,
    deliverySlot: today(16),
    notes: null,
    timeline: timelineFor(row.status, row.placedAt),
  };
}

function timelineFor(
  status: OrderStatus,
  placedAt: string,
): AdminOrderDetail['timeline'] {
  const flow: { key: OrderStatus; label: string }[] = [
    { key: 'paid', label: 'تم الدفع' },
    { key: 'processing', label: 'قيد التجهيز' },
    { key: 'out_for_delivery', label: 'قيد التوصيل' },
    { key: 'installing', label: 'قيد التركيب' },
    { key: 'completed', label: 'مكتمل' },
  ];
  const order: OrderStatus[] = [
    'draft', 'pending_payment', 'paid', 'processing', 'out_for_delivery', 'delivered', 'installing', 'completed',
  ];
  const currentIdx = order.indexOf(status);
  const base = new Date(placedAt).getTime();
  return flow.map((step, i) => {
    const done = currentIdx >= order.indexOf(step.key);
    return { key: step.key, label: step.label, at: done ? new Date(base + i * 2 * 3_600_000).toISOString() : null, done };
  });
}
