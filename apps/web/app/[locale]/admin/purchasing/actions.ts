'use server';

/**
 * Purchasing server actions — supplier create, PO create, and RECEIVING.
 * Receiving validates with the unit-tested pure rules, applies an atomic
 * 'purchase' ledger move (ref = PO number), captures serials/batch for
 * electronics warranty lookup, and recomputes the PO status. Sample mode →
 * documented no-ops.
 */
import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { parseSerials, validateReceive, poStatusFromItems, type PoStatus } from '@/lib/pure/inventory';

export interface PurchActionResult {
  ok: boolean;
  live: boolean;
  id?: string;
  error?: string;
}

function done(live: boolean, error?: string, id?: string): PurchActionResult {
  if (!error) revalidatePath('/[locale]/admin/purchasing', 'page');
  return { ok: !error, live, error, id };
}

export async function addSupplier(name: string, phone: string | null): Promise<PurchActionResult> {
  if (!name.trim()) return { ok: false, live: false, error: 'name' };
  const client = await getServerClient();
  if (!client) return done(false);
  const { data, error } = await client.from('suppliers').insert({ name: name.trim(), phone }).select('id').single();
  return done(true, error?.message, (data as { id: string } | null)?.id);
}

export interface NewPoLine {
  variantId: string;
  qty: number;
  unitCost: number;
}

export async function createPo(
  supplierId: string | null,
  locationId: string,
  lines: NewPoLine[],
): Promise<PurchActionResult> {
  const valid = lines.filter((l) => l.variantId && Number.isInteger(l.qty) && l.qty > 0);
  if (!valid.length) return { ok: false, live: false, error: 'lines' };
  const client = await getServerClient();
  if (!client) return done(false);
  const { data: po, error } = await client
    .from('purchase_orders')
    .insert({ supplier_id: supplierId, location_id: locationId, status: 'ordered' })
    .select('id')
    .single();
  if (error || !po) return done(true, error?.message ?? 'po_failed');
  const poId = (po as { id: string }).id;
  const { error: iErr } = await client.from('purchase_order_items').insert(
    valid.map((l) => ({ po_id: poId, variant_id: l.variantId, qty_ordered: l.qty, unit_cost: l.unitCost })),
  );
  return done(true, iErr?.message, poId);
}

/**
 * Receive qty against a PO line: validate → atomic 'purchase' ledger move →
 * serial rows (count must equal qty when provided) → line + PO status update.
 */
export async function receivePoLine(
  poId: string,
  lineId: string,
  qty: number,
  serialsRaw: string,
  batchNo: string | null,
): Promise<PurchActionResult> {
  const client = await getServerClient();
  if (!client) return done(false);
  try {
    const [{ data: line }, { data: po }] = await Promise.all([
      client.from('purchase_order_items').select('id, variant_id, qty_ordered, qty_received').eq('id', lineId).single(),
      client.from('purchase_orders').select('id, po_number, location_id, status').eq('id', poId).single(),
    ]);
    if (!line || !po) return done(true, 'not_found');
    const l = line as { id: string; variant_id: string; qty_ordered: number; qty_received: number };
    const p = po as { id: string; po_number: string; location_id: string; status: PoStatus };

    const serials = serialsRaw.trim() ? parseSerials(serialsRaw) : null;
    const check = validateReceive(
      { qty_ordered: l.qty_ordered, qty_received: l.qty_received },
      qty,
      serials ? serials.length : null,
    );
    if (!check.ok) return done(true, check.reason);

    const { error: mvErr } = await client.rpc('apply_stock_move', {
      p_variant: l.variant_id,
      p_location: p.location_id,
      p_qty: qty,
      p_kind: 'purchase',
      p_ref: p.po_number,
      p_batch: batchNo,
      p_note: null,
    });
    if (mvErr) return done(true, mvErr.message);

    if (serials?.length) {
      const { error: serErr } = await client.from('product_serials').insert(
        serials.map((s) => ({
          variant_id: l.variant_id,
          serial: s,
          status: 'in_stock',
          location_id: p.location_id,
          batch_no: batchNo,
          po_id: p.id,
        })),
      );
      if (serErr) return done(true, `serials: ${serErr.message}`);
    }

    await client.from('purchase_order_items').update({ qty_received: l.qty_received + qty }).eq('id', lineId);

    // Recompute PO status from all lines (unit-tested rule).
    const { data: allLines } = await client
      .from('purchase_order_items')
      .select('qty_ordered, qty_received')
      .eq('po_id', poId);
    const next = poStatusFromItems(
      ((allLines ?? []) as { qty_ordered: number; qty_received: number }[]),
      p.status,
    );
    if (next !== p.status) await client.from('purchase_orders').update({ status: next }).eq('id', poId);

    return done(true);
  } catch (e) {
    return done(true, e instanceof Error ? e.message : 'unknown');
  }
}
