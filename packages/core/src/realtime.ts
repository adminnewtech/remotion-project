/**
 * Supabase Realtime helpers.
 *
 * Platform-agnostic subscription utilities for live order status, driver GPS,
 * and any table change feed. Each helper returns the `RealtimeChannel` so
 * callers can `supabase.removeChannel(channel)` (or `channel.unsubscribe()`)
 * on teardown (e.g. a React `useEffect` cleanup).
 */
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import type { DriverLocation, Order, OrderStatus } from '@elite/types';
import type { EliteClient } from './client';

export type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface SubscribeOptions {
  /** Which change events to listen for. Defaults to '*'. */
  event?: PostgresEvent;
  /** Postgres `column=eq.value` filter, e.g. `order_id=eq.<uuid>`. */
  filter?: string;
  /** Schema name. Defaults to 'public'. */
  schema?: string;
  /** Optional channel name override (defaults to a stable, unique name). */
  channelName?: string;
}

/**
 * Subscribe to row changes on a table. Generic over the row shape `T`.
 * Returns the channel; call `client.removeChannel(channel)` to clean up.
 */
export function subscribeToTable<T = Record<string, unknown>>(
  client: EliteClient,
  table: string,
  cb: (payload: RealtimePostgresChangesPayload<T & Record<string, unknown>>) => void,
  opts: SubscribeOptions = {},
): RealtimeChannel {
  const schema = opts.schema ?? 'public';
  const event = opts.event ?? '*';
  const name = opts.channelName ?? `rt:${schema}:${table}:${opts.filter ?? 'all'}`;

  const channel = client.channel(name);
  // The supabase-js overloads are loosely typed for postgres_changes; the
  // cast keeps our public surface strongly typed without fighting them.
  channel.on(
    'postgres_changes' as never,
    { event, schema, table, ...(opts.filter ? { filter: opts.filter } : {}) } as never,
    ((payload: RealtimePostgresChangesPayload<T>) => cb(payload)) as never,
  );
  channel.subscribe();
  return channel;
}

/**
 * Stream the live driver location for a delivery task. Fires on every new
 * GPS ping inserted for the task.
 */
export function subscribeToDriverLocation(
  client: EliteClient,
  taskId: string,
  cb: (loc: DriverLocation) => void,
): RealtimeChannel {
  return subscribeToTable<DriverLocation>(
    client,
    'driver_locations',
    (payload) => {
      if (payload.new && Object.keys(payload.new).length > 0) {
        cb(payload.new as DriverLocation);
      }
    },
    { event: 'INSERT', filter: `task_id=eq.${taskId}`, channelName: `rt:driver_loc:${taskId}` },
  );
}

/**
 * Stream order status changes for a single order (e.g. to update a tracking
 * UI as it moves paid → processing → out_for_delivery → delivered).
 */
export function subscribeToOrderStatus(
  client: EliteClient,
  orderId: string,
  cb: (status: OrderStatus, order: Order) => void,
): RealtimeChannel {
  return subscribeToTable<Order>(
    client,
    'orders',
    (payload) => {
      const next = payload.new as Order | undefined;
      if (next && next.status) cb(next.status, next);
    },
    { event: 'UPDATE', filter: `id=eq.${orderId}`, channelName: `rt:order_status:${orderId}` },
  );
}
