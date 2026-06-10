import 'server-only';

/**
 * Server-side data layer.
 *
 * Each function tries the live `@elite/core` read against the request-scoped
 * Supabase client; when the client is absent (no env) OR the live read returns
 * nothing, it falls back to the clearly-marked sample data so pages always
 * render. This is the single seam between the app and the backend contract.
 */
import { catalog, orders, support } from '@elite/core';
import type {
  Category,
  Order,
  Product,
  ProductWithVariants,
  Review,
  Ticket,
} from '@elite/types';
import type { OrderWithItems, OrderTracking } from '@elite/core';
import { getServerClient } from '@/lib/supabase/server';
import {
  sampleCategories,
  sampleProducts,
  sampleProductWithVariants,
  sampleReviews,
  sampleOrders,
  sampleOrderItems,
  sampleTasks,
  sampleTickets,
} from '@/lib/sample-data';

export async function fetchCategories(): Promise<Category[]> {
  const client = await getServerClient();
  if (client) {
    try {
      const rows = await catalog.listCategories(client);
      if (rows.length) return rows;
    } catch {
      /* fall through to sample data */
    }
  }
  return sampleCategories;
}

export async function fetchProducts(params: {
  categoryId?: string;
  search?: string;
  brand?: string;
} = {}): Promise<Product[]> {
  const client = await getServerClient();
  if (client) {
    try {
      const res = await catalog.listProducts(client, params);
      if (res.items.length) return res.items;
    } catch {
      /* fall through */
    }
  }
  let items = sampleProducts;
  if (params.categoryId) items = items.filter((p) => p.category_id === params.categoryId);
  if (params.brand) items = items.filter((p) => p.brand === params.brand);
  if (params.search) {
    const q = params.search.toLowerCase();
    items = items.filter(
      (p) =>
        p.name_en.toLowerCase().includes(q) ||
        p.name_ar.includes(params.search!) ||
        (p.brand ?? '').toLowerCase().includes(q),
    );
  }
  return items;
}

export async function fetchProduct(slug: string): Promise<ProductWithVariants | null> {
  const client = await getServerClient();
  if (client) {
    try {
      const p = await catalog.getProduct(client, slug);
      if (p) return p;
    } catch {
      /* fall through */
    }
  }
  return sampleProductWithVariants(slug);
}

export async function fetchCategory(slug: string): Promise<Category | null> {
  const cats = await fetchCategories();
  return cats.find((c) => c.slug === slug) ?? null;
}

export async function fetchReviews(productId: string): Promise<Review[]> {
  // Reviews read isn't in the core contract surface; sample-only for v1 UI.
  return sampleReviews(productId);
}

export async function fetchOrders(): Promise<Order[]> {
  const client = await getServerClient();
  if (client) {
    try {
      const rows = await orders.listOrders(client);
      if (rows.length) return rows;
    } catch {
      /* fall through */
    }
  }
  return sampleOrders;
}

export async function fetchOrder(id: string): Promise<OrderWithItems | null> {
  const client = await getServerClient();
  if (client) {
    try {
      const o = await orders.getOrder(client, id);
      if (o) return o;
    } catch {
      /* fall through */
    }
  }
  const o = sampleOrders.find((x) => x.id === id);
  if (!o) return null;
  return { ...o, items: sampleOrderItems(id) };
}

export async function fetchTracking(id: string): Promise<OrderTracking | null> {
  const client = await getServerClient();
  if (client) {
    try {
      const tr = await orders.trackOrder(client, id);
      if (tr) return tr;
    } catch {
      /* fall through */
    }
  }
  const o = sampleOrders.find((x) => x.id === id);
  if (!o) return null;
  return { order: o, tasks: sampleTasks(id), driverLocation: null };
}

export async function fetchTickets(): Promise<Ticket[]> {
  const client = await getServerClient();
  if (client) {
    try {
      const rows = await support.listTickets(client);
      if (rows.length) return rows;
    } catch {
      /* fall through */
    }
  }
  return sampleTickets;
}
