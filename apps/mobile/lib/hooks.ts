/**
 * Data hooks — thin TanStack Query wrappers over @elite/core calls, each with
 * a clearly-guarded sample-data fallback used ONLY when `hasLiveBackend` is
 * false (offline demo). Live builds never touch the sample module.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCategories,
  listProducts,
  getProduct,
  listOrders,
  getOrder,
  trackOrder,
  listMyTasks,
  listTickets,
  getTicket,
  type OrderWithItems,
  type OrderTracking,
} from '@elite/core';
import type {
  Category,
  FulfillmentTask,
  Order,
  Product,
  ProductWithVariants,
} from '@elite/types';
import { getSupabase } from './supabase';
import { hasLiveBackend } from './env';
import { qk } from './queryClient';
import {
  SAMPLE_CATEGORIES,
  SAMPLE_PRODUCTS,
  SAMPLE_ORDERS,
  SAMPLE_DRIVER_TASKS,
  SAMPLE_TECH_TASKS,
  SAMPLE_TICKETS,
  sampleProductWithVariants,
  sampleOrderItems,
  sampleTasksForOrder,
  sampleTicketMessages,
} from './sampleData';
import type { TicketWithMessages } from '@elite/core';

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: qk.categories,
    queryFn: async () => {
      const client = getSupabase();
      if (!client || !hasLiveBackend) return SAMPLE_CATEGORIES;
      return listCategories(client);
    },
  });
}

export function useProducts(params?: { categoryId?: string; search?: string; brand?: string }) {
  return useQuery<Product[]>({
    queryKey: qk.products(params),
    queryFn: async () => {
      const client = getSupabase();
      if (!client || !hasLiveBackend) {
        let items = SAMPLE_PRODUCTS;
        if (params?.categoryId) items = items.filter((p) => p.category_id === params.categoryId);
        if (params?.brand) items = items.filter((p) => p.brand === params.brand);
        if (params?.search) {
          const q = params.search.toLowerCase();
          items = items.filter(
            (p) =>
              p.name_en.toLowerCase().includes(q) ||
              p.name_ar.includes(params.search as string) ||
              (p.brand ?? '').toLowerCase().includes(q),
          );
        }
        return items;
      }
      const res = await listProducts(client, params);
      return res.items;
    },
  });
}

export function useProduct(slug: string) {
  return useQuery<ProductWithVariants | null>({
    queryKey: qk.product(slug),
    queryFn: async () => {
      const client = getSupabase();
      if (!client || !hasLiveBackend) return sampleProductWithVariants(slug);
      return getProduct(client, slug);
    },
    enabled: Boolean(slug),
  });
}

export function useOrders() {
  return useQuery<Order[]>({
    queryKey: qk.orders,
    queryFn: async () => {
      const client = getSupabase();
      if (!client || !hasLiveBackend) return SAMPLE_ORDERS;
      return listOrders(client);
    },
  });
}

export function useOrder(id: string) {
  return useQuery<OrderWithItems | null>({
    queryKey: qk.order(id),
    queryFn: async () => {
      const client = getSupabase();
      if (!client || !hasLiveBackend) {
        const order = SAMPLE_ORDERS.find((o) => o.id === id);
        return order ? { ...order, items: sampleOrderItems(id) } : null;
      }
      return getOrder(client, id);
    },
    enabled: Boolean(id),
  });
}

export function useOrderTracking(id: string) {
  return useQuery<OrderTracking | null>({
    queryKey: qk.orderTracking(id),
    queryFn: async () => {
      const client = getSupabase();
      if (!client || !hasLiveBackend) {
        const order = SAMPLE_ORDERS.find((o) => o.id === id);
        if (!order) return null;
        return { order, tasks: sampleTasksForOrder(id), driverLocation: null };
      }
      return trackOrder(client, id);
    },
    enabled: Boolean(id),
    // Refresh periodically as a fallback to the realtime subscription.
    refetchInterval: 15_000,
  });
}

export function useMyTasks(kind: 'delivery' | 'installation') {
  return useQuery<FulfillmentTask[]>({
    queryKey: [...qk.myTasks, kind],
    queryFn: async () => {
      const client = getSupabase();
      if (!client || !hasLiveBackend) {
        return kind === 'delivery' ? SAMPLE_DRIVER_TASKS : SAMPLE_TECH_TASKS;
      }
      const tasks = await listMyTasks(client);
      return tasks.filter((t) => t.type === kind);
    },
  });
}

export function useTickets() {
  return useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const client = getSupabase();
      if (!client || !hasLiveBackend) return SAMPLE_TICKETS;
      return listTickets(client);
    },
  });
}

export function useTicket(id: string) {
  return useQuery<TicketWithMessages | null>({
    queryKey: qk.ticket(id),
    queryFn: async () => {
      const client = getSupabase();
      if (!client || !hasLiveBackend) {
        const ticket = SAMPLE_TICKETS.find((t) => t.id === id);
        return ticket ? { ...ticket, messages: sampleTicketMessages(id) } : null;
      }
      return getTicket(client, id);
    },
    enabled: Boolean(id),
  });
}

/** Re-export query helpers so screens import from one place. */
export { useMutation, useQueryClient };
