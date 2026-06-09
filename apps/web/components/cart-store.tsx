'use client';

/**
 * Client cart store.
 *
 * The authoritative cart lives in Supabase (`@elite/core` cart.* + RLS) once a
 * user is signed in. For guest browsing and dev without env, we keep a
 * localStorage-backed cart so the storefront (cart button, cart page,
 * checkout) is fully interactive. On sign-in this would be merged server-side.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cart as coreCart } from '@elite/core';
import { FREE_DELIVERY_THRESHOLD_KWD } from '@elite/types';

export interface CartLine {
  variantId: string;
  productSlug: string;
  nameAr: string;
  nameEn: string;
  image: string | null;
  unitPrice: number;
  installationFee: number;
  withInstallation: boolean;
  qty: number;
}

interface CartState {
  lines: CartLine[];
  count: number;
  add: (line: Omit<CartLine, 'qty'>, qty?: number) => void;
  setQty: (variantId: string, withInstallation: boolean, qty: number) => void;
  remove: (variantId: string, withInstallation: boolean) => void;
  clear: () => void;
  totals: { subtotal: number; deliveryFee: number; installationFee: number; total: number };
}

const FLAT_DELIVERY_FEE_KWD = coreCart.FLAT_DELIVERY_FEE_KWD;
const round = coreCart.roundKwd;

const CartContext = createContext<CartState | null>(null);
const STORAGE_KEY = 'elite.cart.v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* ignore quota errors */
    }
  }, [lines]);

  const add = useCallback((line: Omit<CartLine, 'qty'>, qty = 1) => {
    setLines((prev) => {
      const idx = prev.findIndex(
        (l) => l.variantId === line.variantId && l.withInstallation === line.withInstallation,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx]!, qty: next[idx]!.qty + qty };
        return next;
      }
      return [...prev, { ...line, qty }];
    });
  }, []);

  const setQty = useCallback((variantId: string, withInstallation: boolean, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => !(l.variantId === variantId && l.withInstallation === withInstallation))
        : prev.map((l) =>
            l.variantId === variantId && l.withInstallation === withInstallation ? { ...l, qty } : l,
          ),
    );
  }, []);

  const remove = useCallback((variantId: string, withInstallation: boolean) => {
    setLines((prev) =>
      prev.filter((l) => !(l.variantId === variantId && l.withInstallation === withInstallation)),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartState>(() => {
    let subtotal = 0;
    let installationFee = 0;
    for (const l of lines) {
      subtotal += l.unitPrice * l.qty;
      if (l.withInstallation) installationFee += l.installationFee * l.qty;
    }
    subtotal = round(subtotal);
    installationFee = round(installationFee);
    const deliveryFee =
      subtotal >= FREE_DELIVERY_THRESHOLD_KWD || subtotal === 0 ? 0 : round(FLAT_DELIVERY_FEE_KWD);
    const total = round(subtotal + deliveryFee + installationFee);
    return {
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      add,
      setQty,
      remove,
      clear,
      totals: { subtotal, deliveryFee, installationFee, total },
    };
  }, [lines, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}
