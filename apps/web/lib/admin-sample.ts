/**
 * Admin sample data — KPIs, staff, dispatch tasks, finance & marketing rows.
 * Clearly-marked placeholders used when the live client/env is absent so the
 * admin app renders in dev. Real builds back these with SQL views / core reads.
 */
import type { FulfillmentTask, Profile } from '@elite/types';

export const adminKpis = {
  today: { revenue: 4860.5, orders: 38, aov: 127.9, conversion: 3.4 },
  week: { revenue: 28950.0, orders: 246, aov: 117.7, conversion: 3.1 },
  month: { revenue: 121430.0, orders: 1042, aov: 116.5, conversion: 3.0 },
};

export const revenueSeries = [
  { label: 'Mon', value: 3200 },
  { label: 'Tue', value: 4100 },
  { label: 'Wed', value: 3850 },
  { label: 'Thu', value: 5200 },
  { label: 'Fri', value: 6100 },
  { label: 'Sat', value: 4860 },
  { label: 'Sun', value: 1640 },
];

export const topProducts = [
  { name: 'Samsung 65" QLED 4K', sold: 42, revenue: 10458 },
  { name: 'LG Split AC 18,000 BTU', sold: 31, revenue: 6169 },
  { name: 'Apple MacBook Air M3', sold: 18, revenue: 6822 },
  { name: 'Bosch 9kg Washer', sold: 27, revenue: 3766 },
  { name: 'Sony HT-A5000 Soundbar', sold: 24, revenue: 2856 },
];

export const lowStock = [
  { sku: 'SAM-001', name: 'Samsung 65" QLED', location: 'Shuwaikh WH', available: 3 },
  { sku: 'LG-001', name: 'LG Split AC 18k', location: 'Shuwaikh WH', available: 2 },
  { sku: 'BOS-001', name: 'Bosch 9kg Washer', location: 'Rai Store', available: 5 },
];

export const demandByArea = [
  { area: 'Salmiya', orders: 64 },
  { area: 'Hawalli', orders: 51 },
  { area: 'Jabriya', orders: 38 },
  { area: 'Farwaniya', orders: 33 },
  { area: 'Ahmadi', orders: 22 },
];

export const liveOrders = [
  { number: 'NT-100245', customer: 'Ahmad K.', area: 'Salmiya', total: 264.0, status: 'out_for_delivery' as const },
  { number: 'NT-100244', customer: 'Sara M.', area: 'Hawalli', total: 119.0, status: 'processing' as const },
  { number: 'NT-100243', customer: 'Yousef A.', area: 'Jabriya', total: 419.0, status: 'paid' as const },
  { number: 'NT-100242', customer: 'Fatima H.', area: 'Farwaniya', total: 214.0, status: 'installing' as const },
  { number: 'NT-100241', customer: 'Omar S.', area: 'Ahmadi', total: 89.9, status: 'delivered' as const },
];

export const staff: (Profile & { zone?: string; utilization?: number })[] = [
  { id: 'd1', role: 'driver', full_name: 'Mubarak D.', phone: '+96550001111', email: null, avatar_url: null, locale: 'ar', is_active: true, created_at: '2025-01-01T00:00:00Z', zone: 'Capital', utilization: 78 },
  { id: 'd2', role: 'driver', full_name: 'Khaled R.', phone: '+96550002222', email: null, avatar_url: null, locale: 'ar', is_active: true, created_at: '2025-01-01T00:00:00Z', zone: 'Hawalli', utilization: 64 },
  { id: 'tech1', role: 'technician', full_name: 'Saleh T.', phone: '+96550003333', email: null, avatar_url: null, locale: 'ar', is_active: true, created_at: '2025-01-01T00:00:00Z', zone: 'Hawalli', utilization: 71 },
  { id: 'tech2', role: 'technician', full_name: 'Nawaf I.', phone: '+96550004444', email: null, avatar_url: null, locale: 'ar', is_active: true, created_at: '2025-01-01T00:00:00Z', zone: 'Ahmadi', utilization: 55 },
  { id: 'emp1', role: 'employee', full_name: 'Layla O.', phone: '+96550005555', email: 'layla@newtechkw.com', avatar_url: null, locale: 'ar', is_active: true, created_at: '2025-01-01T00:00:00Z', zone: '—' },
];

export const dispatchTasks: (FulfillmentTask & { orderNumber: string; customer: string })[] = [
  { id: 't-a', order_id: 'o-1001', type: 'delivery', status: 'unassigned', assignee_id: null, area: 'Salmiya', scheduled_for: '2026-06-10', window_start: '2026-06-10T14:00:00Z', window_end: '2026-06-10T16:00:00Z', sequence: null, orderNumber: 'NT-100245', customer: 'Ahmad K.' },
  { id: 't-b', order_id: 'o-1003', type: 'installation', status: 'assigned', assignee_id: 'tech1', area: 'Hawalli', scheduled_for: '2026-06-10', window_start: '2026-06-10T11:00:00Z', window_end: '2026-06-10T13:00:00Z', sequence: 1, orderNumber: 'NT-100242', customer: 'Fatima H.' },
  { id: 't-c', order_id: 'o-1005', type: 'delivery', status: 'en_route', assignee_id: 'd1', area: 'Jabriya', scheduled_for: '2026-06-09', window_start: '2026-06-09T15:00:00Z', window_end: '2026-06-09T17:00:00Z', sequence: 2, orderNumber: 'NT-100243', customer: 'Yousef A.' },
  { id: 't-d', order_id: 'o-1006', type: 'installation', status: 'unassigned', assignee_id: null, area: 'Ahmadi', scheduled_for: '2026-06-11', window_start: '2026-06-11T09:00:00Z', window_end: '2026-06-11T11:00:00Z', sequence: null, orderNumber: 'NT-100248', customer: 'Omar S.' },
];

export const invoicesZoho = [
  { id: 'INV-2041', order: 'NT-100245', customer: 'Ahmad K.', amount: 264.0, status: 'Paid', date: '2026-06-08' },
  { id: 'INV-2040', order: 'NT-100231', customer: 'Sara M.', amount: 120.5, status: 'Paid', date: '2026-06-07' },
  { id: 'INV-2039', order: 'NT-100210', customer: 'Fatima H.', amount: 214.0, status: 'Sent', date: '2026-06-07' },
];

export const expensesZoho = [
  { id: 'EXP-118', vendor: 'Salik Logistics', category: 'Delivery', amount: 320.0, date: '2026-06-05' },
  { id: 'EXP-117', vendor: 'Shuwaikh Warehouse', category: 'Rent', amount: 1500.0, date: '2026-06-01' },
];

export const metaCampaigns = [
  { id: 'cmp-1', name: 'Summer AC Sale', status: 'Active', spend: 420.5, reach: 84200, roas: 4.2 },
  { id: 'cmp-2', name: 'QLED TV Retargeting', status: 'Active', spend: 260.0, reach: 31500, roas: 6.1 },
  { id: 'cmp-3', name: 'New Arrivals — Laptops', status: 'Paused', spend: 95.0, reach: 12100, roas: 2.4 },
];
