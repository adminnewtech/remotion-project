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
