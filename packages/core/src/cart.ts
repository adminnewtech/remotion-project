/**
 * Cart operations + a pure totals helper.
 *
 * Money is KWD with 3 decimals (fils). All computed amounts are rounded to
 * 3 decimals to stay consistent with the DB `numeric(10,3)` columns.
 */
import type { CartItem, Product, ProductVariant } from '@elite/types';
import { FREE_DELIVERY_THRESHOLD_KWD } from '@elite/types';
import type { EliteClient } from './client';

/** Flat delivery fee (KWD) applied below the free-delivery threshold. */
export const FLAT_DELIVERY_FEE_KWD = 1.5;

/** Round to 3 decimal places (KWD / fils precision). */
export function roundKwd(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/**
 * Find the user's active cart, creating one if none exists.
 * RLS ensures users only ever touch their own carts.
 */
export async function getOrCreateCart(
  client: EliteClient,
  userId: string,
): Promise<{ id: string; user_id: string; status: string }> {
  const { data: existing, error } = await client
    .from('carts')
    .select('id, user_id, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing as { id: string; user_id: string; status: string };

  const { data: created, error: createError } = await client
    .from('carts')
    .insert({ user_id: userId, status: 'active' })
    .select('id, user_id, status')
    .single();
  if (createError) throw createError;
  return created as { id: string; user_id: string; status: string };
}

/**
 * Add an item to the cart. The DB has a unique
 * (cart_id, variant_id, with_installation) constraint, so this upserts and
 * merges quantity on conflict.
 */
export async function addItem(
  client: EliteClient,
  cartId: string,
  variantId: string,
  qty = 1,
  withInstallation = false,
): Promise<CartItem> {
  const { data: existing, error: findError } = await client
    .from('cart_items')
    .select('*')
    .eq('cart_id', cartId)
    .eq('variant_id', variantId)
    .eq('with_installation', withInstallation)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    return updateItem(client, (existing as CartItem).id, (existing as CartItem).qty + qty);
  }

  const { data, error } = await client
    .from('cart_items')
    .insert({
      cart_id: cartId,
      variant_id: variantId,
      qty,
      with_installation: withInstallation,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as CartItem;
}

/** Set the quantity of a cart item. Passing qty <= 0 removes the item. */
export async function updateItem(
  client: EliteClient,
  itemId: string,
  qty: number,
): Promise<CartItem> {
  if (qty <= 0) {
    await removeItem(client, itemId);
    throw new Error('updateItem: qty <= 0 removed the item; nothing to return.');
  }
  const { data, error } = await client
    .from('cart_items')
    .update({ qty })
    .eq('id', itemId)
    .select('*')
    .single();
  if (error) throw error;
  return data as CartItem;
}

/** Remove a single cart item. */
export async function removeItem(client: EliteClient, itemId: string): Promise<void> {
  const { error } = await client.from('cart_items').delete().eq('id', itemId);
  if (error) throw error;
}

/** List the items in a cart. */
export async function listCartItems(client: EliteClient, cartId: string): Promise<CartItem[]> {
  const { data, error } = await client
    .from('cart_items')
    .select('*')
    .eq('cart_id', cartId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CartItem[];
}

export interface CartTotals {
  subtotal: number;
  deliveryFee: number;
  installationFee: number;
  total: number;
}

/** Minimal pricing context the totals helper needs per cart item. */
export interface PricingContext {
  /** variant_id → variant (for price / sale_price). */
  variants: Record<string, Pick<ProductVariant, 'id' | 'price' | 'sale_price' | 'product_id'>>;
  /** product_id → product (for installation_fee). */
  products: Record<string, Pick<Product, 'id' | 'installation_fee'>>;
}

/**
 * Pure totals calculation. No I/O — given cart items and a pricing lookup,
 * compute subtotal, delivery fee, installation fee and grand total in KWD.
 *
 * Rules:
 *  - Unit price = `sale_price` when set, else `price`.
 *  - Subtotal = Σ(unitPrice × qty).
 *  - Installation fee = Σ(product.installation_fee × qty) for items flagged
 *    `with_installation`.
 *  - Delivery is free when subtotal ≥ FREE_DELIVERY_THRESHOLD_KWD, else a flat
 *    FLAT_DELIVERY_FEE_KWD.
 *  - Total = subtotal + deliveryFee + installationFee.
 */
export function cartTotals(items: CartItem[], pricing: PricingContext): CartTotals {
  let subtotal = 0;
  let installationFee = 0;

  for (const item of items) {
    const variant = pricing.variants[item.variant_id];
    if (!variant) continue;
    const unitPrice = variant.sale_price ?? variant.price;
    subtotal += unitPrice * item.qty;

    if (item.with_installation) {
      const product = pricing.products[variant.product_id];
      if (product) installationFee += product.installation_fee * item.qty;
    }
  }

  subtotal = roundKwd(subtotal);
  installationFee = roundKwd(installationFee);
  const deliveryFee =
    subtotal >= FREE_DELIVERY_THRESHOLD_KWD ? 0 : roundKwd(FLAT_DELIVERY_FEE_KWD);
  const total = roundKwd(subtotal + deliveryFee + installationFee);

  return { subtotal, deliveryFee, installationFee, total };
}
