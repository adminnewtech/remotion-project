/**
 * Orders — listing, detail, tracking, and checkout via Edge Function.
 */
import type {
  CheckoutRequest,
  CheckoutResult,
  DriverLocation,
  FulfillmentTask,
  Order,
  OrderItem,
} from '@elite/types';
import type { EliteClient } from './client';

/** Order with its line items, used in detail views. */
export interface OrderWithItems extends Order {
  items: OrderItem[];
}

/** Live tracking snapshot: the order, its tasks, and the latest GPS ping. */
export interface OrderTracking {
  order: Order;
  tasks: FulfillmentTask[];
  driverLocation: DriverLocation | null;
}

/**
 * List orders. Customers omit `userId` (RLS scopes to their own rows); ops
 * may pass a `userId` to filter, or omit it to list everything they can see.
 */
export async function listOrders(client: EliteClient, userId?: string): Promise<Order[]> {
  let query = client.from('orders').select('*');
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Order[];
}

/** Fetch one order with its line items, or `null` if not visible. */
export async function getOrder(client: EliteClient, id: string): Promise<OrderWithItems | null> {
  const { data: order, error } = await client
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;

  const { data: items, error: itemsError } = await client
    .from('order_items')
    .select('*')
    .eq('order_id', id);
  if (itemsError) throw itemsError;

  return { ...(order as Order), items: (items ?? []) as OrderItem[] };
}

/**
 * Build a tracking snapshot: the order, its fulfillment tasks, and the most
 * recent driver location across those tasks (for the live map).
 */
export async function trackOrder(client: EliteClient, id: string): Promise<OrderTracking | null> {
  const { data: order, error } = await client
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;

  const { data: tasks, error: tasksError } = await client
    .from('fulfillment_tasks')
    .select('*')
    .eq('order_id', id)
    .order('sequence', { ascending: true });
  if (tasksError) throw tasksError;

  const taskList = (tasks ?? []) as FulfillmentTask[];
  let driverLocation: DriverLocation | null = null;
  const taskIds = taskList.map((t) => t.id);
  if (taskIds.length > 0) {
    const { data: loc, error: locError } = await client
      .from('driver_locations')
      .select('driver_id, task_id, lat, lng, heading, speed, recorded_at')
      .in('task_id', taskIds)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (locError) throw locError;
    driverLocation = (loc as DriverLocation | null) ?? null;
  }

  return { order: order as Order, tasks: taskList, driverLocation };
}

/**
 * Run checkout via the `checkout` Edge Function (validates inventory, computes
 * totals, reserves stock, creates the order, initiates payment). The function
 * runs with the service role; never replicate that logic on the client.
 */
export async function checkout(
  client: EliteClient,
  req: CheckoutRequest,
): Promise<CheckoutResult> {
  const { data, error } = await client.functions.invoke<CheckoutResult>('checkout', {
    body: req,
  });
  if (error) throw error;
  if (!data) throw new Error('checkout: Edge Function returned no result.');
  return data;
}
