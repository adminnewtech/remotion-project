/**
 * @elite/core — shared cross-platform core for Elite v1.
 *
 * Platform-agnostic (no next/* or react-native/* imports). Domain types come
 * from @elite/types; this package provides the typed Supabase client factory,
 * data-access functions, realtime helpers, integration adapters, notifications,
 * and TanStack Query options.
 */

// Client
export * from './client';

// Domain modules
export * from './auth';
export * from './catalog';
export * from './cart';
export * from './orders';
export * from './tasks';
export * from './support';
export * from './notifications';

// Realtime
export * from './realtime';

// TanStack Query
export * from './queries';

// Integrations (also available via "@elite/core/integrations")
export * from './integrations';
