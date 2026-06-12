'use server';

/**
 * Orders server actions (OSALPHA gold).
 *
 * `setOrderStatus` mutates `orders.status` through the request-scoped,
 * RLS-gated Supabase client, then fire-and-forgets the `notify` Edge Function
 * so the customer hears about the change on every channel (in-app, push,
 * WhatsApp, email) without blocking the admin UI. When the backend is absent
 * (sample mode) it is a documented no-op returning `{ live: false }` — the
 * client keeps its optimistic value and shows the success toast either way.
 */
import type { OrderStatus } from '@elite/types';
import { getServerClient } from '@/lib/supabase/server';

/** Customer-facing status copy for the notification (ar/en). */
const STATUS_COPY: Partial<Record<OrderStatus, { ar: string; en: string }>> = {
  paid: { ar: 'تم استلام دفعتك وطلبك قيد المعالجة', en: 'Payment received — your order is being processed' },
  processing: { ar: 'طلبك قيد التجهيز', en: 'Your order is being prepared' },
  out_for_delivery: { ar: 'طلبك في الطريق إليك', en: 'Your order is out for delivery' },
  delivered: { ar: 'تم توصيل طلبك', en: 'Your order has been delivered' },
  installing: { ar: 'الفني في طريقه لتركيب طلبك', en: 'Our technician is on the way for installation' },
  completed: { ar: 'اكتمل طلبك — شكراً لتسوقك مع نيوتك', en: 'Order complete — thank you for shopping with Newtech' },
  cancelled: { ar: 'تم إلغاء طلبك', en: 'Your order was cancelled' },
  refunded: { ar: 'تم استرجاع مبلغ طلبك', en: 'Your order was refunded' },
};

export interface SetOrderStatusResult {
  ok: boolean;
  /** Whether the write actually hit the backend. */
  live: boolean;
  error?: string;
}

export async function setOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<SetOrderStatusResult> {
  const client = await getServerClient();
  if (!client) {
    // Sample mode: no backend to persist to. Optimistic UI stands.
    return { ok: true, live: false };
  }
  try {
    const { data: updated, error } = await client
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select('user_id, order_number')
      .single();
    if (error) return { ok: false, live: true, error: error.message };

    // Fire-and-forget: tell the customer on every channel. Never blocks/fails
    // the admin flow — notification problems are logged server-side by notify.
    const row = updated as { user_id: string | null; order_number: string } | null;
    const copy = STATUS_COPY[status];
    if (row?.user_id && copy) {
      void client.functions
        .invoke('notify', {
          body: {
            user_id: row.user_id,
            kind: `order_${status}`,
            title_ar: `طلبك ${row.order_number}`,
            title_en: `Your order ${row.order_number}`,
            body_ar: copy.ar,
            body_en: copy.en,
            data: { order_id: id, status },
          },
        })
        .catch(() => {
          /* notification is best-effort */
        });
    }
    return { ok: true, live: true };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

/** Append an ops note to the order's REAL activity log (order_events). */
export async function addOrderNote(id: string, note: string): Promise<SetOrderStatusResult> {
  const trimmed = note.trim();
  if (!trimmed) return { ok: false, live: false, error: 'empty' };
  const client = await getServerClient();
  if (!client) return { ok: true, live: false };
  try {
    const { error } = await client
      .from('order_events')
      .insert({ order_id: id, kind: 'note', note: trimmed });
    if (error) return { ok: false, live: true, error: error.message };
    await client.from('orders').update({ internal_note: trimmed }).eq('id', id);
    return { ok: true, live: true };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

/** Replace the order's ops tags (filtering/automation hooks). */
export async function setOrderTags(id: string, tags: string[]): Promise<SetOrderStatusResult> {
  const clean = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean))).slice(0, 12);
  const client = await getServerClient();
  if (!client) return { ok: true, live: false };
  try {
    const { error } = await client.from('orders').update({ tags: clean }).eq('id', id);
    if (error) return { ok: false, live: true, error: error.message };
    return { ok: true, live: true };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

// ── Returns / RMA (migration 0021) ──────────────────────────

export interface ReturnResult {
  ok: boolean;
  live: boolean;
  rma?: string;
  returnId?: string;
  error?: string;
}

export interface ReturnLineInput {
  orderItemId: string;
  variantId: string | null;
  qty: number;
  unitPrice: number;
}

/**
 * Open an RMA for an order. Refund amount is Σ qty×unitPrice (KWD fils).
 * Logged to the order's audit trail as a 'note' event.
 */
export async function createReturn(
  orderId: string,
  reason: string,
  lines: ReturnLineInput[],
  restock: boolean,
): Promise<ReturnResult> {
  const valid = lines.filter((l) => Number.isInteger(l.qty) && l.qty > 0);
  if (!reason.trim() || !valid.length) return { ok: false, live: false, error: 'input' };
  const client = await getServerClient();
  if (!client) return { ok: true, live: false, rma: 'RMA-DEMO', returnId: 'demo' };
  try {
    const amount = Math.round(valid.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 1000) / 1000;
    const { data: ret, error } = await client
      .from('returns')
      .insert({ order_id: orderId, reason: reason.trim(), refund_amount: amount, restock })
      .select('id, rma_number')
      .single();
    if (error || !ret) return { ok: false, live: true, error: error?.message ?? 'rma_failed' };
    const r = ret as { id: string; rma_number: string };
    const { error: liErr } = await client.from('return_items').insert(
      valid.map((l) => ({
        return_id: r.id,
        order_item_id: l.orderItemId,
        variant_id: l.variantId,
        qty: l.qty,
        unit_price: l.unitPrice,
      })),
    );
    if (liErr) return { ok: false, live: true, error: liErr.message };
    await client.from('order_events').insert({
      order_id: orderId,
      kind: 'note',
      note: `فتح مرتجع ${r.rma_number} — ${reason.trim()} (${amount.toFixed(3)} د.ك)`,
    });
    return { ok: true, live: true, rma: r.rma_number, returnId: r.id };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

/**
 * Receive + refund an RMA in one ops step: restock each line via the ATOMIC
 * ledger ('return' move, ref = RMA), write a negative captured payment, mark
 * the order refunded when the refund covers its total, and close the RMA.
 */
export async function settleReturn(returnId: string): Promise<ReturnResult> {
  const client = await getServerClient();
  if (!client) return { ok: true, live: false };
  try {
    const { data: ret } = await client
      .from('returns')
      .select('id, rma_number, order_id, status, refund_amount, restock, location_id')
      .eq('id', returnId)
      .single();
    if (!ret) return { ok: false, live: true, error: 'not_found' };
    const r = ret as {
      id: string; rma_number: string; order_id: string; status: string;
      refund_amount: number; restock: boolean; location_id: string | null;
    };
    if (r.status === 'refunded' || r.status === 'rejected') {
      return { ok: false, live: true, error: 'closed' };
    }

    if (r.restock) {
      let locId = r.location_id;
      if (!locId) {
        const { data: loc } = await client.from('locations').select('id').order('created_at').limit(1).single();
        locId = (loc as { id: string } | null)?.id ?? null;
      }
      const { data: items } = await client
        .from('return_items')
        .select('variant_id, qty')
        .eq('return_id', r.id);
      for (const it of (items ?? []) as { variant_id: string | null; qty: number }[]) {
        if (!it.variant_id || !locId) continue;
        const { error: mvErr } = await client.rpc('apply_stock_move', {
          p_variant: it.variant_id,
          p_location: locId,
          p_qty: it.qty,
          p_kind: 'return',
          p_ref: r.rma_number,
          p_batch: null,
          p_note: null,
        });
        if (mvErr) return { ok: false, live: true, error: mvErr.message };
      }
    }

    if (r.refund_amount > 0) {
      await client.from('payments').insert({
        order_id: r.order_id,
        method: 'knet',
        status: 'refunded',
        amount: -r.refund_amount,
        gateway_ref: r.rma_number,
      });
      const { data: ord } = await client.from('orders').select('total').eq('id', r.order_id).single();
      if (ord && r.refund_amount >= Number((ord as { total: number }).total)) {
        await client.from('orders').update({ status: 'refunded' }).eq('id', r.order_id);
      }
    }

    await client.from('returns').update({ status: 'refunded' }).eq('id', r.id);
    await client.from('order_events').insert({
      order_id: r.order_id,
      kind: 'note',
      note: `تمت تسوية المرتجع ${r.rma_number} — استرداد ${r.refund_amount.toFixed(3)} د.ك${r.restock ? ' + إعادة للمخزون' : ''}`,
    });
    return { ok: true, live: true, rma: r.rma_number };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}
