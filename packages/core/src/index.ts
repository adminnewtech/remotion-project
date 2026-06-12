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
export * from './analytics';

// Realtime
export * from './realtime';

// TanStack Query
export * from './queries';

// Integrations (also available via "@elite/core/integrations")
export * from './integrations';

/**
 * Grouped namespace exports.
 *
 * The flat exports above are the primary API (used e.g. by the mobile app:
 * `import { checkout } from '@elite/core'`). These namespace objects let
 * consumers that prefer grouping write `import { orders } from '@elite/core'`
 * and call `orders.checkout(...)` (used by the web app).
 */
import * as authNs from './auth';
import * as catalogNs from './catalog';
import * as cartNs from './cart';
import * as ordersNs from './orders';
import * as tasksNs from './tasks';
import * as supportNs from './support';
import * as realtimeNs from './realtime';
import * as notificationsNs from './notifications';
import * as analyticsNs from './analytics';
import * as aiNs from './ai';

export const auth = authNs;
export const catalog = catalogNs;
export const cart = cartNs;
export const orders = ordersNs;
export const tasks = tasksNs;
export const support = supportNs;
export const realtime = realtimeNs;
export const notifications = notificationsNs;
export const analytics = analyticsNs;
export const ai = aiNs;
