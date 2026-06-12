import 'server-only';

/**
 * Single-customer 360 seam (OSALPHA gold) — the unified profile no competitor
 * unifies for retail + installation: orders, payments, support tickets, and
 * installation/warranty events on ONE timeline, plus LTV + an RFM-style tier.
 * First-party reads with sample fallback. Money is KWD (3 decimals).
 */
import type { OrderStatus } from '@elite/types';
import { getServerClient } from '@/lib/supabase/server';
import { tierOf } from '@/lib/pure/customer-tier';

export type TimelineKind = 'order' | 'payment' | 'ticket' | 'install';
export interface TimelineEvent {
  kind: TimelineKind;
  at: string;
  title: string;
  detail: string;
  amount: number | null;
  status?: string;
}

export interface CustomerNote {
  id: string;
  kind: 'note' | 'task';
  body: string;
  due_at: string | null;
  done: boolean;
  created_at: string;
}

export interface OwnedDevice {
  serial: string;
  product: string;
  status: string;
  boughtAt: string | null;
}

export interface Customer360 {
  live: boolean;
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  joinedAt: string;
  orders: number;
  spent: number;
  avgOrder: number;
  lastOrderAt: string | null;
  tier: 'champion' | 'loyal' | 'active' | 'at_risk' | 'new';
  openTickets: number;
  loyaltyPoints: number;
  notes: CustomerNote[];
  devices: OwnedDevice[];
  timeline: TimelineEvent[];
}

const PAID: OrderStatus[] = ['paid', 'processing', 'out_for_delivery', 'delivered', 'installing', 'completed'];
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export async function fetchCustomer360(id: string): Promise<Customer360 | null> {
  const client = await getServerClient();
  if (client) {
    try {
      const { data: p } = await client.from('profiles').select('id, full_name, phone, email, created_at, role, loyalty_points').eq('id', id).maybeSingle();
      if (p) {
        const prof = p as { id: string; full_name: string | null; phone: string | null; email: string | null; created_at: string; loyalty_points?: number };
        const { data: orders } = await client
          .from('orders')
          .select('id, order_number, total, status, placed_at, created_at')
          .eq('user_id', id)
          .order('created_at', { ascending: false })
          .limit(100);
        const orderRows = (orders ?? []) as OrderRow[];
        const orderIds = orderRows.map((o) => o.id);

        const [{ data: payments }, { data: tickets }, { data: notes }, { data: serials }] = await Promise.all([
          orderIds.length ? client.from('payments').select('order_id, amount, method, status, created_at').in('order_id', orderIds) : Promise.resolve({ data: [] as PaymentRow[] }),
          client.from('tickets').select('id, subject, status, kind, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(50),
          client.from('customer_notes').select('id, kind, body, due_at, done, created_at').eq('customer_id', id).order('created_at', { ascending: false }).limit(30),
          orderIds.length
            ? client.from('product_serials').select('serial, status, order_id, variant_id, created_at, product_variants(products(name_ar))').in('order_id', orderIds)
            : Promise.resolve({ data: [] as unknown[] }),
        ]);
        const ticketRows = (tickets ?? []) as TicketRow[];

        const paidOrders = orderRows.filter((o) => PAID.includes(o.status));
        const spent = round3(paidOrders.reduce((s, o) => s + (o.total || 0), 0));
        const lastOrderAt = orderRows[0]?.placed_at ?? orderRows[0]?.created_at ?? null;
        const orderNoById = new Map(orderRows.map((o) => [o.id, o.order_number]));

        const timeline: TimelineEvent[] = [];
        for (const o of orderRows) {
          timeline.push({ kind: 'order', at: o.placed_at ?? o.created_at, title: `طلب ${o.order_number}`, detail: STATUS_AR[o.status] ?? o.status, amount: o.total, status: o.status });
          if (o.status === 'installing' || o.status === 'completed') {
            timeline.push({ kind: 'install', at: o.placed_at ?? o.created_at, title: `تركيب — ${o.order_number}`, detail: 'مهمة تركيب', amount: null });
          }
        }
        for (const pay of (payments ?? []) as PaymentRow[]) {
          timeline.push({ kind: 'payment', at: pay.created_at, title: `دفعة ${pay.method?.toUpperCase?.() ?? ''}`, detail: `${orderNoById.get(pay.order_id) ?? ''} · ${pay.status}`, amount: pay.amount });
        }
        for (const tk of ticketRows) {
          timeline.push({ kind: 'ticket', at: tk.created_at, title: tk.subject || 'تذكرة دعم', detail: `${tk.kind ?? ''} · ${tk.status}`, amount: null, status: tk.status });
        }
        timeline.sort((a, b) => (a.at < b.at ? 1 : -1));

        const devices: OwnedDevice[] = ((serials ?? []) as {
          serial: string; status: string; order_id: string | null; created_at: string;
          product_variants: { products: { name_ar: string } | null } | null;
        }[]).map((d) => ({
          serial: d.serial,
          product: d.product_variants?.products?.name_ar ?? '—',
          status: d.status,
          boughtAt: d.order_id ? (orderRows.find((o) => o.id === d.order_id)?.placed_at ?? null) : null,
        }));

        return {
          live: true,
          id: prof.id,
          name: prof.full_name ?? '—',
          phone: prof.phone,
          email: prof.email,
          joinedAt: prof.created_at,
          orders: orderRows.length,
          spent,
          avgOrder: paidOrders.length ? round3(spent / paidOrders.length) : 0,
          lastOrderAt,
          tier: tierOf(orderRows.length, spent, lastOrderAt),
          openTickets: ticketRows.filter((t) => t.status === 'open').length,
          loyaltyPoints: prof.loyalty_points ?? 0,
          notes: ((notes ?? []) as CustomerNote[]),
          devices,
          timeline: timeline.slice(0, 60),
        };
      }
    } catch {
      /* fall through */
    }
  }
  // Sample fallback for any id.
  return {
    live: false,
    id,
    name: 'أحمد الكندري',
    phone: '+96550010001',
    email: 'ahmad@example.com',
    joinedAt: '2025-09-01T00:00:00Z',
    orders: 7,
    spent: 1264.5,
    avgOrder: 180.64,
    lastOrderAt: '2026-06-08T10:00:00Z',
    tier: 'champion',
    openTickets: 1,
    loyaltyPoints: 1264,
    notes: [
      { id: 'n1', kind: 'task', body: 'متابعة عرض كاميرات للمحل الجديد', due_at: '2026-06-15', done: false, created_at: '2026-06-10T09:00:00Z' },
    ],
    devices: [
      { serial: 'AZD-M660-00911', product: 'داش كام أزدوم M660', status: 'sold', boughtAt: '2026-06-08T10:00:00Z' },
    ],
    timeline: [
      { kind: 'order', at: '2026-06-08T10:00:00Z', title: 'طلب NT-100245', detail: 'مكتمل', amount: 264, status: 'completed' },
      { kind: 'install', at: '2026-06-08T13:00:00Z', title: 'تركيب — NT-100245', detail: 'مهمة تركيب', amount: null },
      { kind: 'payment', at: '2026-06-08T10:02:00Z', title: 'دفعة KNET', detail: 'NT-100245 · paid', amount: 264 },
      { kind: 'ticket', at: '2026-06-05T09:00:00Z', title: 'استفسار ضمان ساوندبار', detail: 'warranty · open', amount: null, status: 'open' },
    ],
  };
}

const STATUS_AR: Partial<Record<OrderStatus, string>> = {
  paid: 'مدفوع', processing: 'قيد التجهيز', out_for_delivery: 'قيد التوصيل',
  delivered: 'تم التوصيل', installing: 'قيد التركيب', completed: 'مكتمل',
  cancelled: 'ملغي', refunded: 'مسترجع', pending_payment: 'بانتظار الدفع', draft: 'مسودة',
};

interface OrderRow { id: string; order_number: string; total: number; status: OrderStatus; placed_at: string | null; created_at: string }
interface PaymentRow { order_id: string; amount: number; method: string | null; status: string; created_at: string }
interface TicketRow { id: string; subject: string | null; status: string; kind: string | null; created_at: string }
