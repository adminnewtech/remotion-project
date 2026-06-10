/**
 * Analytics reads for the admin dashboard.
 *
 * Each function calls a SECURITY DEFINER `admin_*` RPC defined in migration
 * 0010_analytics.sql. Those RPCs gate on `is_ops()` server-side, so a non-ops
 * caller gets a `forbidden` (42501) error — the dashboard is ops/admin only.
 * Money is KWD (3 decimals); the SQL preserves numeric precision and we surface
 * it as `number`.
 */
import type { OrderStatus, FulfillmentType } from '@elite/types';
import type { EliteClient } from './client';

export interface RevenueByDay {
  day: string; // YYYY-MM-DD
  orders: number;
  revenue: number;
  subtotal: number;
  delivery_fees: number;
  installation_fees: number;
  discounts: number;
}

export interface OrdersByStatus {
  status: OrderStatus;
  orders: number;
  total_value: number;
}

export interface SalesByArea {
  area: string;
  orders: number;
  revenue: number;
}

export interface TopProduct {
  product_id: string;
  name_en: string | null;
  name_ar: string | null;
  brand: string | null;
  units_sold: number;
  revenue: number;
  orders: number;
}

export interface LowStockItem {
  variant_id: string;
  sku: string | null;
  product_id: string;
  name_en: string | null;
  name_ar: string | null;
  on_hand: number;
  reserved: number;
  available: number;
}

export interface StaffUtilization {
  staff_id: string;
  full_name: string | null;
  role: 'driver' | 'technician';
  open_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  total_tasks: number;
}

export interface SlaMetrics {
  type: FulfillmentType;
  completed: number;
  avg_cycle_hours: number | null;
  on_time: number;
  windowed_completed: number;
}

/** Revenue per day for paid+ orders, optionally bounded by date (YYYY-MM-DD). */
export async function getRevenueByDay(
  client: EliteClient,
  range?: { from?: string; to?: string },
): Promise<RevenueByDay[]> {
  const { data, error } = await client.rpc('admin_revenue_by_day', {
    p_from: range?.from ?? null,
    p_to: range?.to ?? null,
  });
  if (error) throw error;
  return (data ?? []) as RevenueByDay[];
}

/** Order counts + value grouped by status. */
export async function getOrdersByStatus(client: EliteClient): Promise<OrdersByStatus[]> {
  const { data, error } = await client.rpc('admin_orders_by_status', {});
  if (error) throw error;
  return (data ?? []) as OrdersByStatus[];
}

/** Revenue + order count grouped by Kuwait delivery area. */
export async function getSalesByArea(client: EliteClient): Promise<SalesByArea[]> {
  const { data, error } = await client.rpc('admin_sales_by_area', {});
  if (error) throw error;
  return (data ?? []) as SalesByArea[];
}

/** Best-selling products by units (from the cached roll-up). */
export async function getTopProducts(
  client: EliteClient,
  limit = 20,
): Promise<TopProduct[]> {
  const { data, error } = await client.rpc('admin_top_products', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as TopProduct[];
}

/** Active variants at/below the available-stock threshold. */
export async function getLowStock(
  client: EliteClient,
  threshold = 5,
): Promise<LowStockItem[]> {
  const { data, error } = await client.rpc('admin_low_stock', { p_threshold: threshold });
  if (error) throw error;
  return (data ?? []) as LowStockItem[];
}

/** Open/completed/failed task counts per driver & technician. */
export async function getStaffUtilization(client: EliteClient): Promise<StaffUtilization[]> {
  const { data, error } = await client.rpc('admin_staff_utilization', {});
  if (error) throw error;
  return (data ?? []) as StaffUtilization[];
}

/** Fulfillment SLA: avg cycle time + on-time rate, per task type. */
export async function getSla(client: EliteClient): Promise<SlaMetrics[]> {
  const { data, error } = await client.rpc('admin_sla', {});
  if (error) throw error;
  return (data ?? []) as SlaMetrics[];
}

/**
 * Convenience: fetch the whole dashboard in parallel. `lowStockThreshold` and
 * `topProductsLimit` tune the heavier sections.
 */
export async function getDashboard(
  client: EliteClient,
  opts: {
    range?: { from?: string; to?: string };
    lowStockThreshold?: number;
    topProductsLimit?: number;
  } = {},
): Promise<{
  revenueByDay: RevenueByDay[];
  ordersByStatus: OrdersByStatus[];
  salesByArea: SalesByArea[];
  topProducts: TopProduct[];
  lowStock: LowStockItem[];
  staffUtilization: StaffUtilization[];
  sla: SlaMetrics[];
}> {
  const [
    revenueByDay,
    ordersByStatus,
    salesByArea,
    topProducts,
    lowStock,
    staffUtilization,
    sla,
  ] = await Promise.all([
    getRevenueByDay(client, opts.range),
    getOrdersByStatus(client),
    getSalesByArea(client),
    getTopProducts(client, opts.topProductsLimit ?? 20),
    getLowStock(client, opts.lowStockThreshold ?? 5),
    getStaffUtilization(client),
    getSla(client),
  ]);
  return {
    revenueByDay,
    ordersByStatus,
    salesByArea,
    topProducts,
    lowStock,
    staffUtilization,
    sla,
  };
}
