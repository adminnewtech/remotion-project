import 'server-only';

/**
 * Admin customers data seam (OSALPHA gold) — native CRM-lite.
 *
 * Lists customers from `profiles` (role = customer) and enriches each with a
 * real order count + lifetime spend + last-order date, aggregated from our own
 * `orders`. First-party — no external CRM. Sample fallback keeps the page
 * rendering with no env. Money is KWD (3 decimals).
 */
import type { OrderStatus } from '@elite/types';
import { getServerClient } from '@/lib/supabase/server';

export interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  orders: number;
  spent: number;
  lastOrderAt: string | null;
  joinedAt: string;
}

export interface CustomersData {
  live: boolean;
  rows: CustomerRow[];
  totalCustomers: number;
  withOrders: number;
  totalSpent: number;
}

const PAID: OrderStatus[] = [
  'paid',
  'processing',
  'out_for_delivery',
  'delivered',
  'installing',
  'completed',
];
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export async function fetchCustomers(): Promise<CustomersData> {
  const client = await getServerClient();
  if (client) {
    try {
      const { data: profiles } = await client
        .from('profiles')
        .select('id, full_name, phone, email, created_at')
        .eq('role', 'customer')
        .order('created_at', { ascending: false })
        .limit(500);

      if (profiles && profiles.length) {
        const ids = (profiles as ProfileRow[]).map((p) => p.id);
        const { data: orders } = await client
          .from('orders')
          .select('user_id, total, status, placed_at, created_at')
          .in('user_id', ids);

        const agg = new Map<string, { orders: number; spent: number; last: string | null }>();
        for (const o of (orders ?? []) as OrderRow[]) {
          if (!o.user_id) continue;
          const cur = agg.get(o.user_id) ?? { orders: 0, spent: 0, last: null };
          cur.orders += 1;
          if (PAID.includes(o.status)) cur.spent += o.total || 0;
          const at = o.placed_at ?? o.created_at;
          if (!cur.last || at > cur.last) cur.last = at;
          agg.set(o.user_id, cur);
        }

        const rows: CustomerRow[] = (profiles as ProfileRow[]).map((p) => {
          const a = agg.get(p.id);
          return {
            id: p.id,
            name: p.full_name ?? '—',
            phone: p.phone,
            email: p.email,
            orders: a?.orders ?? 0,
            spent: round3(a?.spent ?? 0),
            lastOrderAt: a?.last ?? null,
            joinedAt: p.created_at,
          };
        });
        rows.sort((x, y) => y.spent - x.spent);
        return {
          live: true,
          rows,
          totalCustomers: rows.length,
          withOrders: rows.filter((r) => r.orders > 0).length,
          totalSpent: round3(rows.reduce((s, r) => s + r.spent, 0)),
        };
      }
    } catch {
      /* fall through */
    }
  }
  return { live: false, rows: SAMPLE, totalCustomers: SAMPLE.length, withOrders: SAMPLE.filter((r) => r.orders > 0).length, totalSpent: round3(SAMPLE.reduce((s, r) => s + r.spent, 0)) };
}

const SAMPLE: CustomerRow[] = [
  { id: 'c1', name: 'أحمد الكندري', phone: '+96550010001', email: 'ahmad@example.com', orders: 7, spent: 1264.5, lastOrderAt: '2026-06-08T10:00:00Z', joinedAt: '2025-09-01T00:00:00Z' },
  { id: 'c2', name: 'سارة المطيري', phone: '+96550010002', email: null, orders: 4, spent: 712.0, lastOrderAt: '2026-06-05T14:00:00Z', joinedAt: '2025-10-12T00:00:00Z' },
  { id: 'c3', name: 'يوسف العنزي', phone: '+96550010003', email: null, orders: 2, spent: 419.0, lastOrderAt: '2026-05-22T09:00:00Z', joinedAt: '2026-01-03T00:00:00Z' },
  { id: 'c4', name: 'فاطمة الهاجري', phone: '+96550010004', email: 'fatima@example.com', orders: 1, spent: 214.0, lastOrderAt: '2026-06-01T16:00:00Z', joinedAt: '2026-03-18T00:00:00Z' },
  { id: 'c5', name: 'عمر الشمري', phone: '+96550010005', email: null, orders: 0, spent: 0, lastOrderAt: null, joinedAt: '2026-06-10T00:00:00Z' },
];

interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
}
interface OrderRow {
  user_id: string | null;
  total: number;
  status: OrderStatus;
  placed_at: string | null;
  created_at: string;
}
