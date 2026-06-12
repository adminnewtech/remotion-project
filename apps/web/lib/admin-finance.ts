import 'server-only';

/**
 * Admin finance data seam (OSALPHA gold) — native, NOT Zoho Books.
 *
 * Everything is derived from our own data: revenue + invoices come from
 * `orders` (+ payment status), operating costs from the native `expenses`
 * table (migration 0016). This replaces the Zoho-synced read with first-party
 * figures so we can drop the Zoho dependency. Sample fallback keeps the page
 * rendering with no env. Money is KWD (3 decimals).
 */
import type { OrderStatus } from '@elite/types';
import { getServerClient } from '@/lib/supabase/server';
import { invoicesZoho, expensesZoho } from '@/lib/admin-sample';

export interface FinanceInvoice {
  id: string;
  customer: string;
  amount: number;
  status: 'paid' | 'sent';
  date: string;
}

export interface FinanceExpense {
  id: string;
  vendor: string;
  category: string;
  amount: number;
  date: string;
}

export interface FinanceData {
  live: boolean;
  revenue: number;
  expenses: number;
  net: number;
  outstanding: number;
  invoices: FinanceInvoice[];
  expenseList: FinanceExpense[];
}

/** Order statuses that count as realized revenue (payment captured onward). */
const PAID: OrderStatus[] = [
  'paid',
  'processing',
  'out_for_delivery',
  'delivered',
  'installing',
  'completed',
];

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export async function fetchFinance(): Promise<FinanceData> {
  const client = await getServerClient();
  if (client) {
    try {
      const [{ data: orderRows }, { data: expenseRows }] = await Promise.all([
        client
          .from('orders')
          .select('order_number, user_id, total, status, placed_at, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
        client
          .from('expenses')
          .select('id, vendor, category, amount, incurred_on')
          .order('incurred_on', { ascending: false })
          .limit(50),
      ]);

      if (orderRows && orderRows.length) {
        const orders = orderRows as OrderRow[];
        // Resolve customer names.
        const userIds = Array.from(new Set(orders.map((o) => o.user_id).filter(Boolean) as string[]));
        const names = new Map<string, string>();
        if (userIds.length) {
          const { data: custRows } = await client
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          for (const c of (custRows ?? []) as { id: string; full_name: string | null }[]) {
            if (c.full_name) names.set(c.id, c.full_name);
          }
        }

        const revenue = round3(
          orders.filter((o) => PAID.includes(o.status)).reduce((s, o) => s + (o.total || 0), 0),
        );
        const outstanding = orders.filter((o) => o.status === 'pending_payment').length;

        const invoices: FinanceInvoice[] = orders.slice(0, 12).map((o) => ({
          id: o.order_number,
          customer: (o.user_id && names.get(o.user_id)) || 'عميل',
          amount: o.total,
          status: PAID.includes(o.status) ? 'paid' : 'sent',
          date: (o.placed_at ?? o.created_at).slice(0, 10),
        }));

        const expenseList: FinanceExpense[] = ((expenseRows ?? []) as ExpenseRow[]).map((e) => ({
          id: e.id.slice(0, 8),
          vendor: e.vendor,
          category: e.category,
          amount: e.amount,
          date: e.incurred_on,
        }));
        const expenses = round3(expenseList.reduce((s, e) => s + e.amount, 0));

        return {
          live: true,
          revenue,
          expenses,
          net: round3(revenue - expenses),
          outstanding,
          invoices,
          expenseList,
        };
      }
    } catch {
      /* fall through */
    }
  }

  // Sample fallback.
  const invoices: FinanceInvoice[] = invoicesZoho.map((i) => ({
    id: i.id,
    customer: i.customer,
    amount: i.amount,
    status: i.status === 'Paid' ? 'paid' : 'sent',
    date: i.date,
  }));
  const expenseList: FinanceExpense[] = expensesZoho.map((e) => ({
    id: e.id,
    vendor: e.vendor,
    category: e.category,
    amount: e.amount,
    date: e.date,
  }));
  const revenue = round3(invoices.reduce((s, i) => s + i.amount, 0));
  const expenses = round3(expenseList.reduce((s, e) => s + e.amount, 0));
  return {
    live: false,
    revenue,
    expenses,
    net: round3(revenue - expenses),
    outstanding: invoices.filter((i) => i.status === 'sent').length,
    invoices,
    expenseList,
  };
}

interface OrderRow {
  order_number: string;
  user_id: string | null;
  total: number;
  status: OrderStatus;
  placed_at: string | null;
  created_at: string;
}

interface ExpenseRow {
  id: string;
  vendor: string;
  category: string;
  amount: number;
  incurred_on: string;
}
