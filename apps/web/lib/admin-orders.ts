import 'server-only';

/**
 * Admin orders data seam (OSALPHA gold).
 *
 * Reads through `@elite/core` `orders.listOrders` / `orders.getOrder` against
 * the request-scoped Supabase client, and derives the four orders KPIs from the
 * analytics getters (`getRevenueByDay` + `getOrdersByStatus`). When the client
 * is absent (no env) OR a live read is empty, every section falls back to the
 * clearly-marked gold sample set below, so the orders pages always render.
 *
 * Money is KWD (3 decimals). The list rows are flattened into a view shape
 * (`AdminOrderRow`) that the gold DataTable renders directly — the row carries a
 * display channel/payment/customer label plus the raw `Order` status enum.
 *
 * Order status is mutated via the `setOrderStatus` server action. `@elite/core`
 * has no orders write in its contract surface yet, so the action writes the
 * `orders.status` column directly through the request-scoped (RLS-gated) client;
 * with no backend it is a documented no-op and the client keeps the optimistic
 * value.
 */
import { analytics, orders as ordersApi } from '@elite/core';
import type { Order, OrderItem, OrderStatus } from '@elite/types';
import { getServerClient } from '@/lib/supabase/server';
import { normalizeChannel } from '@/lib/pure/ops';
import {
  eventsToTimeline,
  deriveTimeline,
  type OrderEventRow,
  type TimelineStep,
} from '@/lib/pure/order-timeline';
import {
  sampleAdminOrders,
  sampleAdminOrderDetail,
  type AdminOrderRow,
  type AdminOrderDetail,
  type OrderChannel,
} from '@/lib/admin-orders-sample';

export type { AdminOrderRow, AdminOrderDetail, OrderChannel };

export interface AdminOrdersKpis {
  /** Orders placed today. */
  ordersToday: number;
  /** Revenue from today's orders (KWD). */
  revenueToday: number;
  /** Orders currently out for delivery. */
  outForDelivery: number;
  /** Orders waiting on installation. */
  awaitingInstall: number;
}

export interface AdminOrdersData {
  /** Whether any section came from the live backend. */
  live: boolean;
  kpis: AdminOrdersKpis;
  rows: AdminOrderRow[];
}

/** Deterministic channel pick from a stable key (sample only — no channel col). */
const CHANNELS: OrderChannel[] = ['store', 'pos', 'whatsapp', 'workshop'];
function channelFor(key: string): OrderChannel {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return CHANNELS[h % CHANNELS.length]!;
}

const PAY_BY_CHANNEL: Record<OrderChannel, string> = {
  store: 'KNET',
  pos: 'كاش',
  whatsapp: 'رابط دفع',
  workshop: 'تابي ×4',
};

/** Map a live `Order` row into the gold DataTable view shape. */
function toRow(o: Order): AdminOrderRow {
  // REAL channel column (migration 0022); hash only as legacy/sample fallback.
  const stored = (o as unknown as { channel?: string }).channel;
  const channel: OrderChannel = stored
    ? (normalizeChannel(stored) === 'online' ? 'store' : (normalizeChannel(stored) as OrderChannel))
    : channelFor(o.id || o.order_number);
  const itemsCount = Math.max(1, Math.round((o.subtotal || 0) / 80) || 1);
  return {
    id: o.id,
    number: o.order_number.startsWith('#') ? o.order_number : `#${o.order_number}`,
    customer: o.user_id ? `عميل ${o.user_id.slice(0, 6)}` : 'عميل',
    channel,
    items: itemsCount,
    itemsLabel: o.notes ?? `${itemsCount} منتجات`,
    total: o.total,
    status: o.status,
    pay: PAY_BY_CHANNEL[channel],
    placedAt: o.placed_at ?? o.created_at,
  };
}

const DAY = 86_400_000;
function isToday(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < DAY;
}

/** Live orders list + derived KPIs; sample fallback per-section. */
export async function fetchAdminOrders(): Promise<AdminOrdersData> {
  const client = await getServerClient();
  if (client) {
    try {
      const list = await ordersApi.listOrders(client);
      if (list.length) {
        const rows = list.map(toRow);
        const todays = list.filter((o) => isToday(o.placed_at ?? o.created_at));
        const kpis: AdminOrdersKpis = {
          ordersToday: todays.length,
          revenueToday: Math.round(todays.reduce((s, o) => s + (o.total || 0), 0) * 1000) / 1000,
          outForDelivery: list.filter((o) => o.status === 'out_for_delivery').length,
          awaitingInstall: list.filter((o) => o.status === 'installing').length,
        };
        return { live: true, kpis, rows };
      }
    } catch {
      /* fall through to sample */
    }
  }
  return { live: false, kpis: sampleKpis(sampleAdminOrders), rows: sampleAdminOrders };
}

function sampleKpis(rows: AdminOrderRow[]): AdminOrdersKpis {
  return {
    ordersToday: rows.filter((r) => isToday(r.placedAt)).length || 6,
    revenueToday:
      Math.round(rows.filter((r) => isToday(r.placedAt)).reduce((s, r) => s + r.total, 0) * 1000) /
        1000 || 1284.75,
    outForDelivery: rows.filter((r) => r.status === 'out_for_delivery').length,
    awaitingInstall: rows.filter((r) => r.status === 'installing').length,
  };
}

export interface OrderDetailData {
  live: boolean;
  detail: AdminOrderDetail;
}

/** One order with items + the address/timeline detail used by the drawer/page. */
export async function fetchAdminOrder(id: string): Promise<OrderDetailData | null> {
  const client = await getServerClient();
  if (client) {
    try {
      const o = await ordersApi.getOrder(client, id);
      if (o) {
        // REAL audit trail (migration 0018): the trigger logs every status
        // transition, so the timeline shows actual event times, not synthetic.
        let events: OrderEventRow[] = [];
        try {
          const { data } = await client
            .from('order_events')
            .select('kind, from_status, to_status, note, created_at')
            .eq('order_id', id)
            .order('created_at', { ascending: true });
          events = (data ?? []) as OrderEventRow[];
        } catch {
          /* timeline falls back to derived */
        }
        return { live: true, detail: toDetail(o, o.items, events) };
      }
    } catch {
      /* fall through */
    }
  }
  const sample = sampleAdminOrderDetail(id);
  if (!sample) return null;
  return { live: false, detail: sample };
}

function toDetail(o: Order, items: OrderItem[], events: OrderEventRow[] = []): AdminOrderDetail {
  const stored = (o as unknown as { channel?: string }).channel;
  const channel: OrderChannel = stored
    ? (normalizeChannel(stored) === 'online' ? 'store' : (normalizeChannel(stored) as OrderChannel))
    : channelFor(o.id || o.order_number);
  return {
    id: o.id,
    number: o.order_number.startsWith('#') ? o.order_number : `#${o.order_number}`,
    customer: o.user_id ? `عميل ${o.user_id.slice(0, 6)}` : 'عميل',
    phone: '+965 5••• ••••',
    channel,
    status: o.status,
    pay: PAY_BY_CHANNEL[channel],
    address: {
      governorate: 'حولي',
      area: '—',
      block: '—',
      street: '—',
      building: '—',
    },
    items: items.map((it) => ({
      id: it.id,
      name: it.name_snapshot,
      sku: it.sku_snapshot,
      qty: it.qty,
      unitPrice: it.unit_price,
      lineTotal: it.line_total,
      withInstallation: it.with_installation,
    })),
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    installationFee: o.installation_fee,
    discountTotal: o.discount_total,
    total: o.total,
    placedAt: o.placed_at ?? o.created_at,
    deliverySlot: o.delivery_slot,
    notes: o.notes,
    tags: ((o as unknown as { tags?: string[] }).tags ?? []),
    internalNote: (o as unknown as { internal_note?: string | null }).internal_note ?? null,
    timeline: events.length
      ? eventsToTimeline(events, o.status)
      : deriveTimeline(o.status, o.placed_at ?? o.created_at),
  };
}

/** Legacy alias — timeline logic now lives (tested) in lib/pure/order-timeline. */
export function buildTimeline(status: OrderStatus, placedAt: string): TimelineStep[] {
  return deriveTimeline(status, placedAt);
}
