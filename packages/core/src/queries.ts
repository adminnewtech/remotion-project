/**
 * TanStack Query integration — a key factory plus ready-made query options.
 *
 * Each `*Query` returns `{ queryKey, queryFn }` you can spread into
 * `useQuery(...)` on web or mobile. The client is passed in (DI) so the same
 * options work across platforms and test setups.
 */
import { getProfile } from './auth';
import {
  type ListProductsParams,
  getProduct,
  listCategories,
  listProducts,
  searchProducts,
} from './catalog';
import { listCartItems } from './cart';
import { getOrder, listOrders, trackOrder } from './orders';
import { type ListMyTasksParams, listMyTasks } from './tasks';
import { getTicket, listTickets } from './support';
import type { EliteClient } from './client';

/**
 * Centralized, hierarchical query keys. Hierarchy enables targeted
 * invalidation, e.g. `queryClient.invalidateQueries({ queryKey: queryKeys.products.all })`.
 */
export const queryKeys = {
  profile: () => ['profile'] as const,

  categories: () => ['categories'] as const,

  products: {
    all: ['products'] as const,
    list: (params: ListProductsParams) => ['products', 'list', params] as const,
    detail: (slug: string) => ['products', 'detail', slug] as const,
    search: (q: string) => ['products', 'search', q] as const,
  },

  cart: {
    items: (cartId: string) => ['cart', cartId, 'items'] as const,
  },

  orders: {
    all: ['orders'] as const,
    list: (userId?: string) => ['orders', 'list', userId ?? 'me'] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    tracking: (id: string) => ['orders', 'tracking', id] as const,
  },

  tasks: {
    mine: (params: ListMyTasksParams) => ['tasks', 'mine', params] as const,
  },

  tickets: {
    all: ['tickets'] as const,
    list: (userId?: string) => ['tickets', 'list', userId ?? 'me'] as const,
    detail: (id: string) => ['tickets', 'detail', id] as const,
  },
} as const;

/** A minimal, framework-agnostic query-options shape compatible with TanStack Query. */
export interface QueryConfig<T> {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
}

// ── Auth / profile ─────────────────────────────────────────
export function profileQuery(client: EliteClient) {
  return {
    queryKey: queryKeys.profile(),
    queryFn: () => getProfile(client),
  } satisfies QueryConfig<Awaited<ReturnType<typeof getProfile>>>;
}

// ── Catalog ────────────────────────────────────────────────
export function categoriesQuery(client: EliteClient) {
  return {
    queryKey: queryKeys.categories(),
    queryFn: () => listCategories(client),
  } satisfies QueryConfig<Awaited<ReturnType<typeof listCategories>>>;
}

export function productsQuery(client: EliteClient, params: ListProductsParams = {}) {
  return {
    queryKey: queryKeys.products.list(params),
    queryFn: () => listProducts(client, params),
  } satisfies QueryConfig<Awaited<ReturnType<typeof listProducts>>>;
}

export function productQuery(client: EliteClient, slug: string) {
  return {
    queryKey: queryKeys.products.detail(slug),
    queryFn: () => getProduct(client, slug),
  } satisfies QueryConfig<Awaited<ReturnType<typeof getProduct>>>;
}

export function productSearchQuery(client: EliteClient, q: string) {
  return {
    queryKey: queryKeys.products.search(q),
    queryFn: () => searchProducts(client, q),
  } satisfies QueryConfig<Awaited<ReturnType<typeof searchProducts>>>;
}

// ── Cart ───────────────────────────────────────────────────
export function cartItemsQuery(client: EliteClient, cartId: string) {
  return {
    queryKey: queryKeys.cart.items(cartId),
    queryFn: () => listCartItems(client, cartId),
  } satisfies QueryConfig<Awaited<ReturnType<typeof listCartItems>>>;
}

// ── Orders ─────────────────────────────────────────────────
export function ordersQuery(client: EliteClient, userId?: string) {
  return {
    queryKey: queryKeys.orders.list(userId),
    queryFn: () => listOrders(client, userId),
  } satisfies QueryConfig<Awaited<ReturnType<typeof listOrders>>>;
}

export function orderQuery(client: EliteClient, id: string) {
  return {
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => getOrder(client, id),
  } satisfies QueryConfig<Awaited<ReturnType<typeof getOrder>>>;
}

export function orderTrackingQuery(client: EliteClient, id: string) {
  return {
    queryKey: queryKeys.orders.tracking(id),
    queryFn: () => trackOrder(client, id),
  } satisfies QueryConfig<Awaited<ReturnType<typeof trackOrder>>>;
}

// ── Tasks (field staff) ────────────────────────────────────
export function myTasksQuery(client: EliteClient, params: ListMyTasksParams = {}) {
  return {
    queryKey: queryKeys.tasks.mine(params),
    queryFn: () => listMyTasks(client, params),
  } satisfies QueryConfig<Awaited<ReturnType<typeof listMyTasks>>>;
}

// ── Support ────────────────────────────────────────────────
export function ticketsQuery(client: EliteClient, userId?: string) {
  return {
    queryKey: queryKeys.tickets.list(userId),
    queryFn: () => listTickets(client, userId),
  } satisfies QueryConfig<Awaited<ReturnType<typeof listTickets>>>;
}

export function ticketQuery(client: EliteClient, id: string) {
  return {
    queryKey: queryKeys.tickets.detail(id),
    queryFn: () => getTicket(client, id),
  } satisfies QueryConfig<Awaited<ReturnType<typeof getTicket>>>;
}
