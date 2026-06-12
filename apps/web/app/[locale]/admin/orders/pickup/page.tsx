import { coerceLocale } from '@/lib/i18n';
import { getServerClient } from '@/lib/supabase/server';
import { PickupClient } from './pickup-client';

export const dynamic = 'force-dynamic';

export interface PickupOrder {
  id: string;
  orderNumber: string;
  customerPhone: string | null;
  pickupCode: string | null;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: { productName: string; qty: number }[];
}

const samplePickupOrders: PickupOrder[] = [
  {
    id: 'o1',
    orderNumber: 'ORD-20260001',
    customerPhone: '96512345678',
    pickupCode: 'PICK-0001',
    status: 'paid',
    totalAmount: 250.000,
    createdAt: new Date().toISOString(),
    items: [{ productName: 'باقة مكيف 1.5 طن شامل التركيب', qty: 1 }],
  },
  {
    id: 'o2',
    orderNumber: 'ORD-20260002',
    customerPhone: '96598765432',
    pickupCode: 'PICK-0002',
    status: 'ready_for_pickup',
    totalAmount: 89.500,
    createdAt: new Date().toISOString(),
    items: [
      { productName: 'تلفزيون سامسونج 55 بوصة', qty: 1 },
      { productName: 'كابل HDMI', qty: 2 },
    ],
  },
];

async function fetchPickupOrders(): Promise<{ live: boolean; orders: PickupOrder[] }> {
  const sb = await getServerClient();
  if (!sb) return { live: false, orders: samplePickupOrders };

  try {
    const { data, error } = await sb
      .from('orders')
      .select(`
        id, status, total_amount, created_at, pickup_code,
        profiles(phone),
        order_items(qty, product_variants(sku, products(name)))
      `)
      .eq('fulfillment', 'pickup')
      .in('status', ['paid', 'ready_for_pickup'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    if (!data || data.length === 0) return { live: true, orders: [] };

    const orders = (data as unknown as PickupOrderRaw[]).map((o, idx) => ({
      id: o.id,
      orderNumber: `ORD-${String(idx + 1).padStart(6, '0')}`,
      customerPhone: (o.profiles as { phone: string } | null)?.phone ?? null,
      pickupCode: o.pickup_code,
      status: o.status,
      totalAmount: o.total_amount,
      createdAt: o.created_at,
      items: (o.order_items ?? []).map((item) => ({
        productName:
          (item.product_variants?.products as { name: string } | null)?.name ??
          item.product_variants?.sku ??
          '—',
        qty: item.qty,
      })),
    }));

    return { live: true, orders };
  } catch {
    return { live: false, orders: samplePickupOrders };
  }
}

interface PickupOrderRaw {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  pickup_code: string | null;
  profiles: unknown;
  order_items: {
    qty: number;
    product_variants: { sku: string | null; products: unknown } | null;
  }[];
}

export default async function PickupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  coerceLocale(raw);
  const { live, orders } = await fetchPickupOrders();
  return <PickupClient orders={orders} live={live} />;
}
