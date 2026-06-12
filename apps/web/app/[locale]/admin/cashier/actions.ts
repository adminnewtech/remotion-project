'use server';

/**
 * Cashier (POS) server actions — native in-store sale.
 *
 * `completeSale` rings up a walk-in sale: it inserts an `orders` row (status
 * completed, attributed to the signed-in cashier as an ops user), its
 * `order_items`, a captured `payments` row, and decrements `inventory.on_hand`
 * for each line — all through the request-scoped, RLS-gated client (ops is
 * permitted by policy). No backend → documented no-op. Money is KWD.
 */
import { getServerClient } from '@/lib/supabase/server';

export interface SaleLine {
  variantId: string;
  name: string;
  sku: string | null;
  unitPrice: number;
  qty: number;
}

export type PosPayment = 'cash' | 'knet';

export interface CompleteSaleResult {
  ok: boolean;
  live: boolean;
  orderNumber?: string;
  error?: string;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export async function completeSale(lines: SaleLine[], payment: PosPayment): Promise<CompleteSaleResult> {
  if (!lines.length) return { ok: false, live: false, error: 'empty' };
  const client = await getServerClient();
  if (!client) {
    // Sample mode: pretend success with a mock number.
    return { ok: true, live: false, orderNumber: `POS-${Math.floor(Math.random() * 9000 + 1000)}` };
  }
  try {
    const { data: auth } = await client.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return { ok: false, live: true, error: 'unauthenticated' };

    const subtotal = round3(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));

    const { data: order, error: oErr } = await client
      .from('orders')
      .insert({
        user_id: uid,
        status: 'completed',
        subtotal,
        delivery_fee: 0,
        installation_fee: 0,
        discount_total: 0,
        total: subtotal,
        currency: 'KWD',
        notes: 'بيع مباشر — كاشير (POS)',
        placed_at: new Date().toISOString(),
      })
      .select('id, order_number')
      .single();
    if (oErr || !order) return { ok: false, live: true, error: oErr?.message ?? 'order_failed' };

    const orderId = (order as { id: string }).id;
    const items = lines.map((l) => ({
      order_id: orderId,
      variant_id: l.variantId.length === 36 ? l.variantId : null, // sample ids aren't uuids
      name_snapshot: l.name,
      sku_snapshot: l.sku,
      unit_price: l.unitPrice,
      qty: l.qty,
      line_total: round3(l.unitPrice * l.qty),
      with_installation: false,
    }));
    const { error: iErr } = await client.from('order_items').insert(items);
    if (iErr) return { ok: false, live: true, error: iErr.message };

    await client.from('payments').insert({
      order_id: orderId,
      method: payment === 'knet' ? 'knet' : 'cod',
      status: 'paid',
      amount: subtotal,
      gateway_ref: 'pos',
    });

    // Best-effort stock decrement (ignore failures so the sale still records).
    for (const l of lines) {
      if (l.variantId.length !== 36) continue;
      const { data: inv } = await client
        .from('inventory')
        .select('id, on_hand')
        .eq('variant_id', l.variantId)
        .limit(1)
        .maybeSingle();
      const row = inv as { id: string; on_hand: number } | null;
      if (row) {
        await client.from('inventory').update({ on_hand: Math.max(0, row.on_hand - l.qty) }).eq('id', row.id);
      }
    }

    return { ok: true, live: true, orderNumber: (order as { order_number: string }).order_number };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}
