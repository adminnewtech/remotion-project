import 'server-only';

/**
 * Purchasing seam (OSALPHA gold) — suppliers + purchase orders with receive
 * progress. First-party (migration 0019). Receiving flows through the atomic
 * ledger function; see ./actions. Sample fallback included.
 */
import { getServerClient } from '@/lib/supabase/server';
import type { PoStatus } from '@/lib/pure/inventory';

export interface SupplierRow {
  id: string;
  name: string;
  phone: string | null;
}

export interface PoLine {
  id: string;
  variantId: string;
  label: string;
  sku: string | null;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
}

export interface PoRow {
  id: string;
  number: string;
  supplier: string;
  location: string;
  locationId: string;
  status: PoStatus;
  createdAt: string;
  lines: PoLine[];
}

export interface PurchasingData {
  live: boolean;
  suppliers: SupplierRow[];
  pos: PoRow[];
  locations: { id: string; name: string }[];
  variants: { id: string; label: string; sku: string | null }[];
}

export async function fetchPurchasing(): Promise<PurchasingData> {
  const client = await getServerClient();
  if (client) {
    try {
      const [{ data: sups }, { data: pos }, { data: items }, { data: locs }, { data: variants }] = await Promise.all([
        client.from('suppliers').select('id, name, phone').eq('is_active', true).order('name'),
        client.from('purchase_orders').select('id, po_number, supplier_id, location_id, status, created_at').order('created_at', { ascending: false }).limit(40),
        client.from('purchase_order_items').select('id, po_id, variant_id, qty_ordered, qty_received, unit_cost'),
        client.from('locations').select('id, name').eq('is_active', true),
        client.from('product_variants').select('id, sku, products(name_ar)').limit(500),
      ]);

      const suppliers = (sups ?? []) as SupplierRow[];
      const locations = ((locs ?? []) as { id: string; name: string }[]);
      const varRows = (variants ?? []) as unknown as { id: string; sku: string | null; products: { name_ar: string } | null }[];
      const varList = varRows.map((v) => ({ id: v.id, label: v.products?.name_ar ?? v.sku ?? '—', sku: v.sku }));
      const varById = new Map(varList.map((v) => [v.id, v]));
      const supById = new Map(suppliers.map((s) => [s.id, s.name]));
      const locById = new Map(locations.map((l) => [l.id, l.name]));

      const linesByPo = new Map<string, PoLine[]>();
      for (const it of (items ?? []) as { id: string; po_id: string; variant_id: string; qty_ordered: number; qty_received: number; unit_cost: number }[]) {
        const v = varById.get(it.variant_id);
        const arr = linesByPo.get(it.po_id) ?? [];
        arr.push({ id: it.id, variantId: it.variant_id, label: v?.label ?? '—', sku: v?.sku ?? null, qty_ordered: it.qty_ordered, qty_received: it.qty_received, unit_cost: Number(it.unit_cost) });
        linesByPo.set(it.po_id, arr);
      }

      const poRows: PoRow[] = ((pos ?? []) as { id: string; po_number: string; supplier_id: string | null; location_id: string; status: PoStatus; created_at: string }[]).map((p) => ({
        id: p.id,
        number: p.po_number,
        supplier: (p.supplier_id && supById.get(p.supplier_id)) || '—',
        location: locById.get(p.location_id) ?? '—',
        locationId: p.location_id,
        status: p.status,
        createdAt: p.created_at,
        lines: linesByPo.get(p.id) ?? [],
      }));

      if (locations.length) return { live: true, suppliers, pos: poRows, locations, variants: varList };
    } catch {
      /* fall through */
    }
  }
  return {
    live: false,
    suppliers: [{ id: 's1', name: 'Carlinkit (الصين)', phone: null }],
    locations: [{ id: 'L1', name: 'معرض الري' }, { id: 'L2', name: 'مخزن الشويخ' }],
    variants: [{ id: 'v1', label: 'داش كام أزدوم M660', sku: 'CA-01001' }],
    pos: [{
      id: 'p1', number: 'PO-1001', supplier: 'Carlinkit (الصين)', location: 'مخزن الشويخ', locationId: 'L2',
      status: 'partial', createdAt: new Date().toISOString(),
      lines: [{ id: 'l1', variantId: 'v1', label: 'داش كام أزدوم M660', sku: 'CA-01001', qty_ordered: 50, qty_received: 20, unit_cost: 22.5 }],
    }],
  };
}
