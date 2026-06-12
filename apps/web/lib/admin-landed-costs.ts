import 'server-only';

/**
 * Landed costs seam (OSALPHA gold) — purchase orders with their cost lines and
 * allocation state. Migration 0028 (po_costs + allocate_landed_costs RPC).
 * Sample fallback included so the page always renders.
 */
import { getServerClient } from '@/lib/supabase/server';
import { round3 } from '@/lib/pure/money';

export type CostKind = 'freight' | 'customs' | 'clearance' | 'other';
export type CostAllocation = 'by_value' | 'by_qty';

export interface PoCostRow {
  id: string;
  kind: CostKind;
  amount: number;
  allocation: CostAllocation;
  note: string | null;
  createdAt: string;
}

export interface PoWithCosts {
  id: string;
  number: string;
  supplier: string;
  status: string;
  createdAt: string;
  /** Total of all po_costs lines (KWD, 3dp). */
  totalCosts: number;
  /** True when at least one PO item has a non-null landed_unit_cost. */
  allocated: boolean;
  costs: PoCostRow[];
}

export interface LandedCostsData {
  live: boolean;
  pos: PoWithCosts[];
}

const SAMPLE: LandedCostsData = {
  live: false,
  pos: [
    {
      id: 'p1',
      number: 'PO-1001',
      supplier: 'Carlinkit (الصين)',
      status: 'partial',
      createdAt: new Date().toISOString(),
      totalCosts: round3(35.5),
      allocated: false,
      costs: [
        {
          id: 'c1',
          kind: 'freight',
          amount: round3(20.0),
          allocation: 'by_value',
          note: 'DHL شحن جوي',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'c2',
          kind: 'customs',
          amount: round3(15.5),
          allocation: 'by_qty',
          note: null,
          createdAt: new Date().toISOString(),
        },
      ],
    },
    {
      id: 'p2',
      number: 'PO-1002',
      supplier: 'Samsung KSA',
      status: 'received',
      createdAt: new Date().toISOString(),
      totalCosts: round3(0),
      allocated: true,
      costs: [],
    },
  ],
};

export async function fetchPoCosts(): Promise<LandedCostsData> {
  const client = await getServerClient();
  if (!client) return SAMPLE;

  try {
    const [{ data: poRows }, { data: costRows }, { data: allocRows }] = await Promise.all([
      client
        .from('purchase_orders')
        .select('id, po_number, supplier_id, status, created_at, suppliers(name)')
        .order('created_at', { ascending: false })
        .limit(40),
      client.from('po_costs').select('id, po_id, kind, amount, allocation, note, created_at').order('created_at'),
      // Check which POs already have landed_unit_cost set on any item.
      client
        .from('purchase_order_items')
        .select('po_id')
        .not('landed_unit_cost', 'is', null),
    ]);

    type RawPo = {
      id: string;
      po_number: string;
      supplier_id: string | null;
      status: string;
      created_at: string;
      suppliers: { name: string } | null;
    };
    type RawCost = {
      id: string;
      po_id: string;
      kind: string;
      amount: number;
      allocation: string;
      note: string | null;
      created_at: string;
    };

    const pos = (poRows ?? []) as unknown as RawPo[];
    const costs = (costRows ?? []) as unknown as RawCost[];
    const allocatedPoIds = new Set(
      ((allocRows ?? []) as unknown as { po_id: string }[]).map((r) => r.po_id),
    );

    const costsByPo = new Map<string, PoCostRow[]>();
    for (const c of costs) {
      const arr = costsByPo.get(c.po_id) ?? [];
      arr.push({
        id: c.id,
        kind: c.kind as CostKind,
        amount: round3(Number(c.amount)),
        allocation: c.allocation as CostAllocation,
        note: c.note,
        createdAt: c.created_at,
      });
      costsByPo.set(c.po_id, arr);
    }

    const result: PoWithCosts[] = pos.map((p) => {
      const lines = costsByPo.get(p.id) ?? [];
      const totalCosts = round3(lines.reduce((s, c) => s + c.amount, 0));
      return {
        id: p.id,
        number: p.po_number,
        supplier: p.suppliers?.name ?? '—',
        status: p.status,
        createdAt: p.created_at,
        totalCosts,
        allocated: allocatedPoIds.has(p.id),
        costs: lines,
      };
    });

    return { live: true, pos: result };
  } catch {
    return SAMPLE;
  }
}
