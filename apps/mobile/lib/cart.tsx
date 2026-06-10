/**
 * Cart context — unifies the live (Supabase via @elite/core) and demo
 * (in-memory) cart so screens share one API. It also caches the variant/product
 * pricing context needed by the pure `cartTotals` helper.
 *
 * Live mode: persists to `carts`/`cart_items` through @elite/core.
 * Demo mode (no backend): keeps items in React state only.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getOrCreateCart,
  addItem as coreAddItem,
  updateItem as coreUpdateItem,
  removeItem as coreRemoveItem,
  listCartItems,
  cartTotals,
  type CartTotals,
  type PricingContext,
} from '@elite/core';
import type { CartItem, ProductVariant, Product } from '@elite/types';
import { getSupabase } from './supabase';
import { hasLiveBackend } from './env';
import { useAuth } from './auth';

interface AddArgs {
  variant: Pick<ProductVariant, 'id' | 'price' | 'sale_price' | 'product_id'>;
  product: Pick<Product, 'id' | 'installation_fee'>;
  qty?: number;
  withInstallation?: boolean;
}

interface CartContextValue {
  items: CartItem[];
  pricing: PricingContext;
  totals: CartTotals;
  count: number;
  loading: boolean;
  cartId: string | null;
  add: (args: AddArgs) => Promise<void>;
  setQty: (itemId: string, qty: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  clear: () => void;
  reload: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

let demoSeq = 0;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [pricing, setPricing] = useState<PricingContext>({ variants: {}, products: {} });
  const [cartId, setCartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const live = hasLiveBackend && Boolean(getSupabase());

  const reload = useCallback(async () => {
    const client = getSupabase();
    if (!live || !client || !profile?.id) return;
    setLoading(true);
    try {
      const cart = await getOrCreateCart(client, profile.id);
      setCartId(cart.id);
      const list = await listCartItems(client, cart.id);
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, [live, profile?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = useCallback(
    async ({ variant, product, qty = 1, withInstallation = false }: AddArgs) => {
      // Always cache pricing for totals.
      setPricing((prev) => ({
        variants: { ...prev.variants, [variant.id]: variant },
        products: { ...prev.products, [product.id]: product },
      }));

      const client = getSupabase();
      if (live && client && profile?.id) {
        const cart = cartId ? { id: cartId } : await getOrCreateCart(client, profile.id);
        if (!cartId) setCartId(cart.id);
        await coreAddItem(client, cart.id, variant.id, qty, withInstallation);
        const list = await listCartItems(client, cart.id);
        setItems(list);
        return;
      }

      // Demo mode: merge in memory on (variant, withInstallation).
      setItems((prev) => {
        const idx = prev.findIndex(
          (i) => i.variant_id === variant.id && i.with_installation === withInstallation,
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx]!, qty: next[idx]!.qty + qty };
          return next;
        }
        return [
          ...prev,
          {
            id: `demo-${++demoSeq}`,
            cart_id: 'demo',
            variant_id: variant.id,
            qty,
            with_installation: withInstallation,
          },
        ];
      });
    },
    [live, profile?.id, cartId],
  );

  const setQty = useCallback(
    async (itemId: string, qty: number) => {
      const client = getSupabase();
      if (live && client) {
        if (qty <= 0) {
          await coreRemoveItem(client, itemId);
        } else {
          await coreUpdateItem(client, itemId, qty);
        }
        if (cartId) setItems(await listCartItems(client, cartId));
        return;
      }
      setItems((prev) =>
        qty <= 0
          ? prev.filter((i) => i.id !== itemId)
          : prev.map((i) => (i.id === itemId ? { ...i, qty } : i)),
      );
    },
    [live, cartId],
  );

  const remove = useCallback((itemId: string) => setQty(itemId, 0), [setQty]);

  const clear = useCallback(() => setItems([]), []);

  const totals = useMemo(() => cartTotals(items, pricing), [items, pricing]);
  const count = useMemo(() => items.reduce((n, i) => n + i.qty, 0), [items]);

  const value = useMemo<CartContextValue>(
    () => ({ items, pricing, totals, count, loading, cartId, add, setQty, remove, clear, reload }),
    [items, pricing, totals, count, loading, cartId, add, setQty, remove, clear, reload],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}
