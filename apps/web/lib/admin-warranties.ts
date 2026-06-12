import 'server-only';
import { getServerClient } from '@/lib/supabase/server';

// ── Shape ──────────────────────────────────────────────────────────────────

export interface WarrantyRow {
  id: string;
  serial_id: string;
  order_id: string | null;
  customer_id: string | null;
  starts_at: string; // date string yyyy-mm-dd
  expires_at: string;
  status: 'active' | 'expired' | 'voided' | 'claimed';

  // Joined from product_serials
  serial: string | null;

  // Joined via product_serials → product_variants → products
  product_name_ar: string | null;
  product_name_en: string | null;
  variant_sku: string | null;

  // Joined from profiles (customer)
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;

  // Computed
  is_live: boolean; // active and still within coverage window today
  days_remaining: number; // negative = already expired
}

export interface WarrantiesData {
  live: boolean;
  rows: WarrantyRow[];
}

// ── Sample fallback ────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// SAMPLE DATA — only shown when the DB connection is unavailable
const SAMPLE_ROWS: WarrantyRow[] = [
  {
    id: 'sample-1',
    serial_id: 'serial-1',
    order_id: 'order-1',
    customer_id: 'cust-1',
    starts_at: offsetDate(-90),
    expires_at: offsetDate(275),
    status: 'active',
    serial: 'SN-2024-001',
    product_name_ar: 'تلفزيون سامسونج 55 بوصة',
    product_name_en: 'Samsung TV 55"',
    variant_sku: 'TV-SAM-55-4K',
    customer_name: 'أحمد العلي',
    customer_email: 'ahmed@example.com',
    customer_phone: '+96550000001',
    is_live: true,
    days_remaining: 275,
  },
  {
    id: 'sample-2',
    serial_id: 'serial-2',
    order_id: 'order-2',
    customer_id: 'cust-2',
    starts_at: offsetDate(-350),
    expires_at: offsetDate(15),
    status: 'active',
    serial: 'SN-2024-002',
    product_name_ar: 'ثلاجة LG',
    product_name_en: 'LG Refrigerator',
    variant_sku: 'FRIDGE-LG-XXL',
    customer_name: 'سارة المطيري',
    customer_email: 'sara@example.com',
    customer_phone: '+96550000002',
    is_live: true,
    days_remaining: 15,
  },
  {
    id: 'sample-3',
    serial_id: 'serial-3',
    order_id: 'order-3',
    customer_id: 'cust-3',
    starts_at: offsetDate(-400),
    expires_at: offsetDate(-35),
    status: 'expired',
    serial: 'SN-2023-099',
    product_name_ar: 'غسالة بوش',
    product_name_en: 'Bosch Washing Machine',
    variant_sku: 'WASH-BOSCH-8KG',
    customer_name: 'فهد الرشيد',
    customer_email: 'fahad@example.com',
    customer_phone: '+96550000003',
    is_live: false,
    days_remaining: -35,
  },
  {
    id: 'sample-4',
    serial_id: 'serial-4',
    order_id: null,
    customer_id: 'cust-4',
    starts_at: offsetDate(-30),
    expires_at: offsetDate(335),
    status: 'active',
    serial: 'SN-2025-010',
    product_name_ar: 'مكيف سبليت',
    product_name_en: 'Split AC Unit',
    variant_sku: 'AC-18K-SPLIT',
    customer_name: 'نورة القحطاني',
    customer_email: null,
    customer_phone: '+96550000004',
    is_live: true,
    days_remaining: 335,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function computeDaysRemaining(expiresAt: string): number {
  const now = new Date(TODAY);
  const exp = new Date(expiresAt);
  return Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Main fetch ─────────────────────────────────────────────────────────────

export async function fetchWarranties(): Promise<WarrantiesData> {
  const sb = await getServerClient();

  if (!sb) {
    // SAMPLE FALLBACK — database connection unavailable
    return { live: false, rows: SAMPLE_ROWS };
  }

  const { data, error } = await sb
    .from('warranties')
    .select(
      `
      id,
      serial_id,
      order_id,
      customer_id,
      starts_at,
      expires_at,
      status,
      product_serials!serial_id (
        serial,
        product_variants!variant_id (
          sku,
          products!product_id (
            name_ar,
            name_en
          )
        )
      ),
      profiles!customer_id (
        full_name,
        email,
        phone
      )
    `,
    )
    .order('expires_at', { ascending: true })
    .limit(500);

  if (error || !data) {
    // Query failed — SAMPLE FALLBACK
    console.warn('[admin-warranties] query error:', error?.message);
    return { live: false, rows: SAMPLE_ROWS };
  }

  // Cast joined rows (generated types are permissive)
  type RawRow = {
    id: string;
    serial_id: string;
    order_id: string | null;
    customer_id: string | null;
    starts_at: string;
    expires_at: string;
    status: string;
    product_serials: {
      serial: string;
      product_variants: {
        sku: string;
        products: { name_ar: string; name_en: string } | null;
      } | null;
    } | null;
    profiles: { full_name: string | null; email: string | null; phone: string | null } | null;
  };

  const rows: WarrantyRow[] = (data as unknown as RawRow[]).map((r) => {
    const days = computeDaysRemaining(r.expires_at);
    return {
      id: r.id,
      serial_id: r.serial_id,
      order_id: r.order_id,
      customer_id: r.customer_id,
      starts_at: r.starts_at,
      expires_at: r.expires_at,
      status: r.status as WarrantyRow['status'],
      serial: r.product_serials?.serial ?? null,
      product_name_ar: r.product_serials?.product_variants?.products?.name_ar ?? null,
      product_name_en: r.product_serials?.product_variants?.products?.name_en ?? null,
      variant_sku: r.product_serials?.product_variants?.sku ?? null,
      customer_name: r.profiles?.full_name ?? null,
      customer_email: r.profiles?.email ?? null,
      customer_phone: r.profiles?.phone ?? null,
      is_live: r.status === 'active' && days > 0,
      days_remaining: days,
    };
  });

  return { live: true, rows };
}
