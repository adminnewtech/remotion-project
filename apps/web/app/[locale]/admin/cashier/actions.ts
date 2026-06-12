'use server';

/**
 * Cashier (POS) server actions — native in-store sale + register lifecycle.
 *
 * All writes go through the request-scoped, RLS-gated client (ops permitted by
 * policy). No backend → documented sample no-op. Money is KWD (3 decimals).
 * Cart math (discount/loyalty/total) is computed by lib/pure/pos so it's
 * unit-tested and identical to the UI.
 */
import { getServerClient } from '@/lib/supabase/server';
import { round3 } from '@/lib/pure/money';
import { cartTotals, type DiscountKind } from '@/lib/pure/pos';

export interface SaleLine {
  variantId: string;
  name: string;
  sku: string | null;
  unitPrice: number;
  qty: number;
}

export type PosPayment = 'cash' | 'knet';

export interface SalePayload {
  lines: SaleLine[];
  payment: PosPayment;
  shiftId?: string | null;
  customerId?: string | null;
  discount?: { id: string; kind: DiscountKind; value: number } | null;
  redeemPoints?: number;
  tendered?: number | null;
}

export interface CompleteSaleResult {
  ok: boolean;
  live: boolean;
  orderNumber?: string;
  orderId?: string;
  total?: number;
  change?: number;
  error?: string;
}

const isUuid = (s: string) => s.length === 36 && s.includes('-');

export async function completeSale(payload: SalePayload): Promise<CompleteSaleResult> {
  const { lines, payment } = payload;
  if (!lines.length) return { ok: false, live: false, error: 'empty' };

  const totals = cartTotals({
    lines,
    discountKind: payload.discount?.kind ?? null,
    discountValue: payload.discount?.value ?? 0,
    redeemPoints: payload.redeemPoints ?? 0,
  });

  const client = await getServerClient();
  if (!client) {
    return { ok: true, live: false, orderNumber: `POS-${Math.floor(Math.random() * 9000 + 1000)}`, total: totals.total };
  }
  try {
    const { data: auth } = await client.auth.getUser();
    const cashierId = auth?.user?.id;
    if (!cashierId) return { ok: false, live: true, error: 'unauthenticated' };

    // Attribute the order to the customer when chosen, else to the cashier.
    const ownerId = payload.customerId && isUuid(payload.customerId) ? payload.customerId : cashierId;
    const discountTotal = round3(totals.discountTotal + totals.loyaltyValue);

    const { data: order, error: oErr } = await client
      .from('orders')
      .insert({
        user_id: ownerId,
        status: 'completed',
        subtotal: totals.subtotal,
        delivery_fee: 0,
        installation_fee: 0,
        discount_total: discountTotal,
        total: totals.total,
        currency: 'KWD',
        channel: 'pos',
        pos_shift_id: payload.shiftId && isUuid(payload.shiftId) ? payload.shiftId : null,
        notes: 'بيع مباشر — كاشير (POS)',
        placed_at: new Date().toISOString(),
      })
      .select('id, order_number')
      .single();
    if (oErr || !order) return { ok: false, live: true, error: oErr?.message ?? 'order_failed' };

    const orderId = (order as { id: string }).id;
    const items = lines.map((l) => ({
      order_id: orderId,
      variant_id: isUuid(l.variantId) ? l.variantId : null,
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
      amount: totals.total,
      gateway_ref: 'pos',
    });

    // Redeem loyalty points (atomic burn). Best-effort: don't fail the sale.
    if (payload.customerId && isUuid(payload.customerId) && (payload.redeemPoints ?? 0) > 0) {
      await client.rpc('redeem_loyalty_points', { p_user_id: payload.customerId, p_points: payload.redeemPoints });
    }

    // Increment discount usage counter (atomic RPC; mirrors checkout).
    if (payload.discount?.id && isUuid(payload.discount.id)) {
      await client.rpc('increment_discount_usage', { p_discount_id: payload.discount.id });
    }

    // Best-effort stock decrement.
    for (const l of lines) {
      if (!isUuid(l.variantId)) continue;
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

    const change = payment === 'cash' && payload.tendered != null ? round3(Math.max(0, payload.tendered - totals.total)) : 0;
    return { ok: true, live: true, orderNumber: (order as { order_number: string }).order_number, orderId, total: totals.total, change };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

/** Save the ticket as a HOLD (draft order + items, no payment, no stock). */
export async function saveQuote(lines: SaleLine[]): Promise<CompleteSaleResult> {
  if (!lines.length) return { ok: false, live: false, error: 'empty' };
  const client = await getServerClient();
  if (!client) return { ok: true, live: false, orderNumber: 'Q-DEMO' };
  try {
    const { data: auth } = await client.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return { ok: false, live: true, error: 'unauthenticated' };
    const subtotal = round3(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
    const { data: order, error } = await client
      .from('orders')
      .insert({
        user_id: uid, status: 'draft', subtotal, delivery_fee: 0,
        installation_fee: 0, discount_total: 0, total: subtotal,
        currency: 'KWD', channel: 'pos', notes: 'عرض سعر — كاشير',
      })
      .select('id, order_number')
      .single();
    if (error || !order) return { ok: false, live: true, error: error?.message ?? 'quote_failed' };
    const o = order as { id: string; order_number: string };
    await client.from('order_items').insert(lines.map((l) => ({
      order_id: o.id,
      variant_id: isUuid(l.variantId) ? l.variantId : null,
      name_snapshot: l.name, sku_snapshot: l.sku,
      unit_price: l.unitPrice, qty: l.qty,
      line_total: round3(l.unitPrice * l.qty), with_installation: false,
    })));
    return { ok: true, live: true, orderNumber: o.order_number, orderId: o.id };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

// ── Held tickets (recall board) ──────────────────────────────────────────────
export interface HeldTicket {
  id: string;
  orderNumber: string;
  total: number;
  itemCount: number;
  createdAt: string;
  lines: SaleLine[];
}

export async function listHolds(): Promise<{ live: boolean; holds: HeldTicket[] }> {
  const client = await getServerClient();
  if (!client) return { live: false, holds: [] };
  try {
    const { data: orders } = await client
      .from('orders')
      .select('id, order_number, total, created_at')
      .eq('channel', 'pos')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(30);
    const rows = (orders ?? []) as { id: string; order_number: string; total: number; created_at: string }[];
    if (!rows.length) return { live: true, holds: [] };
    const ids = rows.map((o) => o.id);
    const { data: items } = await client
      .from('order_items')
      .select('order_id, variant_id, name_snapshot, sku_snapshot, unit_price, qty')
      .in('order_id', ids);
    const byOrder = new Map<string, SaleLine[]>();
    for (const it of (items ?? []) as ItemRow[]) {
      const arr = byOrder.get(it.order_id) ?? [];
      arr.push({
        variantId: it.variant_id ?? 'na',
        name: it.name_snapshot,
        sku: it.sku_snapshot,
        unitPrice: Number(it.unit_price),
        qty: it.qty,
      });
      byOrder.set(it.order_id, arr);
    }
    return {
      live: true,
      holds: rows.map((o) => {
        const lines = byOrder.get(o.id) ?? [];
        return {
          id: o.id,
          orderNumber: o.order_number,
          total: Number(o.total),
          itemCount: lines.reduce((s, l) => s + l.qty, 0),
          createdAt: o.created_at,
          lines,
        };
      }),
    };
  } catch {
    return { live: true, holds: [] };
  }
}

/** Recall a held ticket: return its lines and delete the draft so it isn't double-counted. */
export async function recallHold(orderId: string): Promise<{ ok: boolean; lines: SaleLine[]; error?: string }> {
  const client = await getServerClient();
  if (!client) return { ok: false, lines: [], error: 'no backend' };
  try {
    const { data: items } = await client
      .from('order_items')
      .select('variant_id, name_snapshot, sku_snapshot, unit_price, qty')
      .eq('order_id', orderId);
    const lines: SaleLine[] = ((items ?? []) as ItemRow[]).map((it) => ({
      variantId: it.variant_id ?? 'na',
      name: it.name_snapshot,
      sku: it.sku_snapshot,
      unitPrice: Number(it.unit_price),
      qty: it.qty,
    }));
    // Only delete drafts (safety).
    await client.from('orders').delete().eq('id', orderId).eq('status', 'draft');
    return { ok: true, lines };
  } catch (e) {
    return { ok: false, lines: [], error: e instanceof Error ? e.message : 'unknown' };
  }
}

// ── Customer lookup ───────────────────────────────────────────────────────────
export interface PosCustomer {
  id: string;
  name: string | null;
  phone: string | null;
  loyaltyPoints: number;
}

export async function searchCustomers(query: string): Promise<PosCustomer[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const client = await getServerClient();
  if (!client) return [];
  try {
    const { data } = await client
      .from('profiles')
      .select('id, full_name, phone, loyalty_points')
      .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
      .limit(8);
    return ((data ?? []) as { id: string; full_name: string | null; phone: string | null; loyalty_points: number | null }[]).map((p) => ({
      id: p.id,
      name: p.full_name,
      phone: p.phone,
      loyaltyPoints: p.loyalty_points ?? 0,
    }));
  } catch {
    return [];
  }
}

// ── Shift lifecycle ───────────────────────────────────────────────────────────
export async function openShift(openingFloat: number): Promise<{ ok: boolean; shiftId?: string; error?: string }> {
  const client = await getServerClient();
  if (!client) return { ok: true, shiftId: 'demo-shift' };
  try {
    const { data, error } = await client.rpc('open_pos_shift', { p_opening_float: round3(openingFloat), p_location_id: null });
    if (error) return { ok: false, error: error.message };
    return { ok: true, shiftId: data as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export interface ShiftSummary {
  shiftId: string;
  openingFloat: number;
  cashSales: number;
  knetSales: number;
  totalSales: number;
  orderCount: number;
  payIn: number;
  payOut: number;
  drop: number;
  expectedCash: number;
  countedCash: number | null;
  cashVariance: number | null;
}

function toSummary(j: Record<string, unknown>): ShiftSummary {
  const n = (k: string) => Number(j[k] ?? 0);
  return {
    shiftId: String(j.shift_id ?? ''),
    openingFloat: n('opening_float'),
    cashSales: n('cash_sales'),
    knetSales: n('knet_sales'),
    totalSales: n('total_sales'),
    orderCount: n('order_count'),
    payIn: n('pay_in'),
    payOut: n('pay_out'),
    drop: n('drop'),
    expectedCash: n('expected_cash'),
    countedCash: j.counted_cash == null ? null : Number(j.counted_cash),
    cashVariance: j.cash_variance == null ? null : Number(j.cash_variance),
  };
}

export async function getShiftSummary(shiftId: string): Promise<ShiftSummary | null> {
  const client = await getServerClient();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('pos_shift_summary', { p_shift_id: shiftId });
    if (error || !data) return null;
    return toSummary(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function closeShift(shiftId: string, countedCash: number, notes: string | null): Promise<{ ok: boolean; summary?: ShiftSummary; error?: string }> {
  const client = await getServerClient();
  if (!client) return { ok: true };
  try {
    const { data, error } = await client.rpc('close_pos_shift', {
      p_shift_id: shiftId,
      p_counted_cash: round3(countedCash),
      p_notes: notes,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, summary: toSummary(data as Record<string, unknown>) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function cashMove(shiftId: string, kind: 'pay_in' | 'pay_out' | 'drop', amount: number, reason: string | null): Promise<{ ok: boolean; error?: string }> {
  const client = await getServerClient();
  if (!client) return { ok: true };
  try {
    const { error } = await client.rpc('record_cash_move', {
      p_shift_id: shiftId,
      p_kind: kind,
      p_amount: round3(amount),
      p_reason: reason,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

interface ItemRow {
  order_id: string;
  variant_id: string | null;
  name_snapshot: string;
  sku_snapshot: string | null;
  unit_price: number;
  qty: number;
}
