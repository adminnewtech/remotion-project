// Elite v1 — checkout Edge Function.
// Deno + TypeScript (Supabase Edge Functions).
//
// Flow (see ARCHITECTURE.md 3.3):
//   auth user from JWT
//   → load cart + items + variant prices (DB is source of truth — never trust client prices)
//   → validate inventory (on_hand - reserved >= qty)
//   → reserve stock atomically (reserve_variant_stock RPC)
//   → compute subtotal, delivery fee (free at/over 10 KWD else 1.5 KWD),
//     installation fee (sum products.installation_fee for items with_installation)
//   → apply discount code (percent | amount | free_delivery)
//   → create order + order_items (status 'pending_payment',
//     warranty_expires_at = now + warranty_months)
//   → create payment row (pending)
//   → mark cart converted
//   → return CheckoutResult with placeholder payment_url (TODO gateway)
//
// Money is KWD with 3 decimals. All arithmetic rounded via kwd().

import { serve } from "https://deno.land/std/http/server.ts";
import { handlePreflight, json, jsonError } from "../_shared/cors.ts";
import { AuthError, getAdminClient, getUserFromRequest, kwd } from "../_shared/supabaseAdmin.ts";

const FREE_DELIVERY_THRESHOLD_KWD = 10;
const DELIVERY_FEE_KWD = 1.5;
const DEFAULT_CURRENCY = "KWD";

interface CheckoutRequest {
  cart_id: string;
  address_id: string;
  payment_method: "knet" | "apple_pay" | "google_pay" | "card" | "cod";
  delivery_slot?: { start: string; end: string };
  installation_slot?: { start: string; end: string };
  discount_code?: string;
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  let user;
  try {
    user = await getUserFromRequest(req);
  } catch (e) {
    if (e instanceof AuthError) return jsonError(e.message, 401);
    return jsonError("Authentication failed", 401);
  }

  let body: CheckoutRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!body?.cart_id || !body?.address_id || !body?.payment_method) {
    return jsonError("cart_id, address_id and payment_method are required", 400);
  }

  const admin = getAdminClient();

  try {
    // ── Load and authorize the cart ──────────────────────────────────────
    const { data: cart, error: cartErr } = await admin
      .from("carts")
      .select("id, user_id, status")
      .eq("id", body.cart_id)
      .maybeSingle();

    if (cartErr) throw cartErr;
    if (!cart) return jsonError("Cart not found", 404);
    if (cart.user_id !== user.id) return jsonError("Cart does not belong to caller", 403);
    if (cart.status !== "active") return jsonError("Cart is not active", 409);

    // ── Authorize the delivery address ───────────────────────────────────
    const { data: address, error: addrErr } = await admin
      .from("addresses")
      .select("id, user_id, area")
      .eq("id", body.address_id)
      .maybeSingle();
    if (addrErr) throw addrErr;
    if (!address || address.user_id !== user.id) {
      return jsonError("Address not found for caller", 404);
    }

    // ── Load cart items with variant prices + product info ───────────────
    // DB is the source of truth for price, installation_fee, warranty_months.
    const { data: items, error: itemsErr } = await admin
      .from("cart_items")
      .select(
        `id, qty, with_installation, variant_id,
         product_variants:variant_id (
           id, sku, price, sale_price, is_active,
           products:product_id ( id, name_ar, name_en, installation_fee, warranty_months, is_active )
         )`,
      )
      .eq("cart_id", cart.id);

    if (itemsErr) throw itemsErr;
    if (!items || items.length === 0) return jsonError("Cart is empty", 409);

    // ── Validate inventory availability for each line ────────────────────
    interface PreparedLine {
      variant_id: string;
      name_snapshot: string;
      sku_snapshot: string | null;
      unit_price: number;
      qty: number;
      line_total: number;
      with_installation: boolean;
      warranty_months: number;
      installation_fee: number;
    }
    const prepared: PreparedLine[] = [];

    for (const it of items as any[]) {
      const variant = it.product_variants;
      const product = variant?.products;
      if (!variant || !product) {
        return jsonError(`Variant ${it.variant_id} no longer exists`, 409);
      }
      if (variant.is_active === false || product.is_active === false) {
        return jsonError(`Product "${product?.name_en ?? it.variant_id}" is not available`, 409);
      }

      // Available stock across all locations for this variant.
      const { data: inv, error: invErr } = await admin
        .from("inventory")
        .select("on_hand, reserved")
        .eq("variant_id", it.variant_id);
      if (invErr) throw invErr;

      const available = (inv ?? []).reduce(
        (acc, row: any) => acc + (Number(row.on_hand) - Number(row.reserved)),
        0,
      );
      if (available < it.qty) {
        return jsonError(
          `Insufficient stock for "${product.name_en}" (available ${available}, requested ${it.qty})`,
          409,
          { variant_id: it.variant_id, available },
        );
      }

      // sale_price wins when present.
      const unitPrice = kwd(
        variant.sale_price != null ? Number(variant.sale_price) : Number(variant.price),
      );
      const lineTotal = kwd(unitPrice * it.qty);

      prepared.push({
        variant_id: it.variant_id,
        name_snapshot: product.name_en ?? product.name_ar ?? "Item",
        sku_snapshot: variant.sku ?? null,
        unit_price: unitPrice,
        qty: it.qty,
        line_total: lineTotal,
        with_installation: it.with_installation === true,
        warranty_months: Number(product.warranty_months ?? 12),
        installation_fee: it.with_installation === true
          ? Number(product.installation_fee ?? 0)
          : 0,
      });
    }

    // ── Reserve stock atomically (RPC with row locks) ────────────────────
    // Track what we've reserved so we can roll back on partial failure.
    const reserved: { variant_id: string; qty: number }[] = [];
    for (const line of prepared) {
      const { data: ok, error: rpcErr } = await admin.rpc("reserve_variant_stock", {
        p_variant_id: line.variant_id,
        p_qty: line.qty,
      });
      if (rpcErr) {
        await rollbackReservations(admin, reserved);
        throw rpcErr;
      }
      if (ok !== true) {
        await rollbackReservations(admin, reserved);
        return jsonError(`Stock for "${line.name_snapshot}" became unavailable`, 409);
      }
      reserved.push({ variant_id: line.variant_id, qty: line.qty });
    }

    // ── Compute totals (KWD, 3 decimals) ─────────────────────────────────
    const subtotal = kwd(prepared.reduce((s, l) => s + l.line_total, 0));
    const installationFee = kwd(prepared.reduce((s, l) => s + l.installation_fee, 0));
    let deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD_KWD ? 0 : DELIVERY_FEE_KWD;

    // ── Apply discount code ──────────────────────────────────────────────
    let discountTotal = 0;
    let appliedDiscountId: string | null = null;
    if (body.discount_code) {
      const code = body.discount_code.trim();
      const { data: disc, error: discErr } = await admin
        .from("discounts")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (discErr) throw discErr;

      const now = Date.now();
      const valid =
        disc &&
        disc.is_active === true &&
        (disc.starts_at == null || new Date(disc.starts_at).getTime() <= now) &&
        (disc.ends_at == null || new Date(disc.ends_at).getTime() >= now) &&
        subtotal >= Number(disc.min_subtotal ?? 0) &&
        (disc.usage_limit == null || Number(disc.used_count ?? 0) < Number(disc.usage_limit));

      if (!valid) {
        await rollbackReservations(admin, reserved);
        return jsonError("Invalid or expired discount code", 422);
      }

      if (disc.kind === "percent") {
        discountTotal = kwd(subtotal * (Number(disc.value) / 100));
      } else if (disc.kind === "amount") {
        discountTotal = kwd(Math.min(Number(disc.value), subtotal));
      } else if (disc.kind === "free_delivery") {
        discountTotal = 0;
        deliveryFee = 0;
      }
      appliedDiscountId = disc.id;
    }

    const total = kwd(subtotal + deliveryFee + installationFee - discountTotal);

    // ── Create the order ─────────────────────────────────────────────────
    const deliverySlot = body.delivery_slot
      ? `[${body.delivery_slot.start},${body.delivery_slot.end})`
      : null;

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        user_id: user.id,
        status: "pending_payment",
        subtotal,
        delivery_fee: deliveryFee,
        installation_fee: installationFee,
        discount_total: discountTotal,
        total,
        currency: DEFAULT_CURRENCY,
        address_id: body.address_id,
        delivery_slot: deliverySlot,
        placed_at: new Date().toISOString(),
      })
      .select("id, order_number, total")
      .single();

    if (orderErr || !order) {
      await rollbackReservations(admin, reserved);
      throw orderErr ?? new Error("Failed to create order");
    }

    // ── Create order_items with warranty expiry ──────────────────────────
    const orderItemsPayload = prepared.map((l) => {
      const warrantyExpires = new Date();
      warrantyExpires.setMonth(warrantyExpires.getMonth() + l.warranty_months);
      return {
        order_id: order.id,
        variant_id: l.variant_id,
        name_snapshot: l.name_snapshot,
        sku_snapshot: l.sku_snapshot,
        unit_price: l.unit_price,
        qty: l.qty,
        line_total: l.line_total,
        with_installation: l.with_installation,
        warranty_expires_at: warrantyExpires.toISOString(),
      };
    });

    const { error: oiErr } = await admin.from("order_items").insert(orderItemsPayload);
    if (oiErr) {
      // Best-effort cleanup: order cascade-deletes items; release stock.
      await admin.from("orders").delete().eq("id", order.id);
      await rollbackReservations(admin, reserved);
      throw oiErr;
    }

    // ── Create the pending payment row ───────────────────────────────────
    const { data: payment, error: payErr } = await admin
      .from("payments")
      .insert({
        order_id: order.id,
        method: body.payment_method,
        status: "pending",
        amount: total,
      })
      .select("id")
      .single();
    if (payErr) {
      await admin.from("orders").delete().eq("id", order.id);
      await rollbackReservations(admin, reserved);
      throw payErr;
    }

    // ── Bump discount usage ──────────────────────────────────────────────
    if (appliedDiscountId) {
      await admin.rpc("increment_discount_usage", { p_discount_id: appliedDiscountId })
        .then(({ error }) => {
          // RPC is optional; fall back to a non-atomic update if absent.
          if (error) {
            return admin
              .from("discounts")
              .select("used_count")
              .eq("id", appliedDiscountId!)
              .single()
              .then(({ data }) =>
                admin
                  .from("discounts")
                  .update({ used_count: Number(data?.used_count ?? 0) + 1 })
                  .eq("id", appliedDiscountId!)
              );
          }
        })
        .catch(() => {/* non-fatal */});
    }

    // ── Mark cart converted ──────────────────────────────────────────────
    await admin.from("carts").update({ status: "converted" }).eq("id", cart.id);

    // ── Initiate payment with gateway ────────────────────────────────────
    // TODO(payments): create a payment session with MyFatoorah / Tap here,
    // persist gateway_ref onto the payment row, and use the returned hosted
    // payment page URL. For COD there is no redirect. Safe sandbox fallback:
    let paymentUrl: string | undefined;
    if (body.payment_method !== "cod") {
      const baseUrl = Deno.env.get("PAYMENT_RETURN_URL") ?? "https://pay.newtech.example/checkout";
      paymentUrl = `${baseUrl}?order=${order.order_number}&payment=${payment.id}`;
    }

    const result = {
      order_id: order.id,
      order_number: order.order_number,
      total,
      payment_url: paymentUrl,
    };
    return json(result, 201);
  } catch (err) {
    console.error("[checkout] error", err);
    return jsonError("Checkout failed", 500, {
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

async function rollbackReservations(
  admin: ReturnType<typeof getAdminClient>,
  reserved: { variant_id: string; qty: number }[],
): Promise<void> {
  for (const r of reserved) {
    try {
      await admin.rpc("release_variant_stock", { p_variant_id: r.variant_id, p_qty: r.qty });
    } catch (e) {
      console.error("[checkout] rollback failed for", r.variant_id, e);
    }
  }
}
