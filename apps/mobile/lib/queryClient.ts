/**
 * Shared TanStack Query client. Tuned for a mobile network: keep data fresh
 * for a short window, retry transient failures, and avoid aggressive refetch
 * on every focus (field apps toggle foreground/background constantly).
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

/** Centralised query keys so realtime invalidation stays consistent. */
export const qk = {
  categories: ['categories'] as const,
  products: (params?: unknown) => ['products', params] as const,
  product: (slug: string) => ['product', slug] as const,
  cart: ['cart'] as const,
  orders: ['orders'] as const,
  order: (id: string) => ['order', id] as const,
  orderTracking: (id: string) => ['order', id, 'tracking'] as const,
  myTasks: ['tasks', 'mine'] as const,
  task: (id: string) => ['task', id] as const,
  ticket: (id: string) => ['ticket', id] as const,
  notifications: ['notifications'] as const,
} as const;
