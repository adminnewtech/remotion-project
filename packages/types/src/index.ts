/**
 * @elite/types — the shared contract for Elite v1.
 *
 * Domain types here mirror the Supabase schema in `supabase/migrations/`.
 * Once a Supabase project is linked, `pnpm db:types` regenerates
 * `database.types.ts`; domain types below can then be derived from it.
 */

// ── Enums (mirror SQL enums) ───────────────────────────────
export type UserRole = 'customer' | 'employee' | 'technician' | 'driver' | 'admin';

export type OrderStatus =
  | 'draft'
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'out_for_delivery'
  | 'delivered'
  | 'installing'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'knet' | 'apple_pay' | 'google_pay' | 'card' | 'cod';
export type FulfillmentType = 'delivery' | 'installation' | 'pickup';
export type TaskStatus =
  | 'unassigned'
  | 'assigned'
  | 'accepted'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketKind = 'general' | 'warranty' | 'complaint' | 'return';
/** Conversation source channel (omnichannel inbox). */
export type TicketChannel = 'in_app' | 'whatsapp' | 'instagram' | 'email' | 'chatwoot';
/** Direction of a ticket message relative to the business. */
export type MessageDirection = 'inbound' | 'outbound';
export type MediaKind = 'image' | 'video';
export type DiscountKind = 'percent' | 'amount' | 'free_delivery';
export type Locale = 'ar' | 'en';

export type UUID = string;
export type ISODateTime = string;

// ── Identity ───────────────────────────────────────────────
export interface Profile {
  id: UUID;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  locale: Locale;
  is_active: boolean;
  created_at: ISODateTime;
}

export interface Address {
  id: UUID;
  user_id: UUID;
  label: string | null;
  governorate: string | null;
  area: string | null;
  block: string | null;
  street: string | null;
  building: string | null;
  floor: string | null;
  apartment: string | null;
  extra_directions: string | null;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
}

// ── Catalog ────────────────────────────────────────────────
export interface Category {
  id: UUID;
  parent_id: UUID | null;
  name_ar: string;
  name_en: string;
  slug: string;
  image_url: string | null;
  sort: number;
  is_active: boolean;
}

export interface Product {
  id: UUID;
  category_id: UUID | null;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  brand: string | null;
  slug: string;
  requires_installation: boolean;
  installation_fee: number;
  warranty_months: number;
  is_active: boolean;
}

export interface ProductVariant {
  id: UUID;
  product_id: UUID;
  sku: string | null;
  attributes: Record<string, string>;
  price: number;
  sale_price: number | null;
  barcode: string | null;
  weight_g: number | null;
  is_active: boolean;
}

export interface ProductMedia {
  id: UUID;
  product_id: UUID;
  variant_id: UUID | null;
  url: string;
  kind: MediaKind;
  sort: number;
}

export interface InventoryLevel {
  id: UUID;
  variant_id: UUID;
  location_id: UUID;
  on_hand: number;
  reserved: number;
}

// Convenience composite used across UI
export interface ProductWithVariants extends Product {
  variants: ProductVariant[];
  media: ProductMedia[];
  category?: Category | null;
}

// ── Cart & orders ──────────────────────────────────────────
export interface Cart {
  id: UUID;
  user_id: UUID;
  status: 'active' | 'converted' | 'abandoned';
}

export interface CartItem {
  id: UUID;
  cart_id: UUID;
  variant_id: UUID;
  qty: number;
  with_installation: boolean;
}

export interface Order {
  id: UUID;
  order_number: string;
  user_id: UUID;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  installation_fee: number;
  discount_total: number;
  total: number;
  currency: string;
  address_id: UUID | null;
  delivery_slot: string | null;
  notes: string | null;
  placed_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface OrderItem {
  id: UUID;
  order_id: UUID;
  variant_id: UUID | null;
  name_snapshot: string;
  sku_snapshot: string | null;
  unit_price: number;
  qty: number;
  line_total: number;
  with_installation: boolean;
  warranty_expires_at: ISODateTime | null;
}

export interface Payment {
  id: UUID;
  order_id: UUID;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  gateway_ref: string | null;
}

export interface Discount {
  id: UUID;
  code: string;
  kind: DiscountKind;
  value: number;
  min_subtotal: number;
  starts_at: ISODateTime | null;
  ends_at: ISODateTime | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
}

// ── Logistics & field service ──────────────────────────────
export interface FulfillmentTask {
  id: UUID;
  order_id: UUID;
  type: FulfillmentType;
  status: TaskStatus;
  assignee_id: UUID | null;
  area: string | null;
  scheduled_for: string | null;
  window_start: ISODateTime | null;
  window_end: ISODateTime | null;
  sequence: number | null;
}

export interface DriverLocation {
  driver_id: UUID;
  task_id: UUID | null;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  recorded_at: ISODateTime;
}

export interface ProofOfDelivery {
  id: UUID;
  task_id: UUID;
  photo_url: string | null;
  signature_url: string | null;
  otp_verified: boolean;
  recipient_name: string | null;
  cash_collected: number | null;
  delivered_at: ISODateTime;
}

export interface ChecklistItem {
  label_ar: string;
  label_en: string;
  done: boolean;
}

export interface InstallationJob {
  id: UUID;
  task_id: UUID;
  order_id: UUID;
  checklist: ChecklistItem[];
  before_photos: string[];
  after_photos: string[];
  customer_signature_url: string | null;
  notes: string | null;
  completed_at: ISODateTime | null;
}

// ── Support & engagement ───────────────────────────────────
export interface Ticket {
  id: UUID;
  order_id: UUID | null;
  /** Null for channel tickets (WhatsApp/Chatwoot) not yet bound to a profile. */
  user_id: UUID | null;
  kind: TicketKind;
  status: TicketStatus;
  subject: string;
  assignee_id: UUID | null;
  zoho_desk_id: string | null;
  /** Conversation source. Defaults to 'in_app'. */
  channel: TicketChannel;
  /** Source thread id (WhatsApp wa_id or Chatwoot conversation id). */
  external_id: string | null;
  /** Customer phone for channel tickets (E.164-ish). */
  customer_phone: string | null;
  created_at: ISODateTime;
}

export interface TicketMessage {
  id: UUID;
  ticket_id: UUID;
  /** Null for inbound channel messages with no auth user. */
  sender_id: UUID | null;
  body: string;
  attachments: string[];
  /** Inbound (customer→us) or outbound (us→customer). Defaults to 'inbound'. */
  direction: MessageDirection;
  /** Provider message id (idempotency / receipts). */
  external_id: string | null;
  created_at: ISODateTime;
}

export interface Review {
  id: UUID;
  product_id: UUID;
  user_id: UUID;
  order_item_id: UUID | null;
  rating: number;
  body: string | null;
  is_published: boolean;
}

export interface AppNotification {
  id: UUID;
  user_id: UUID;
  kind: string;
  title_ar: string | null;
  title_en: string | null;
  body_ar: string | null;
  body_en: string | null;
  data: Record<string, unknown>;
  read_at: ISODateTime | null;
  created_at: ISODateTime;
}

// ── DTOs used by Edge Functions ────────────────────────────
export interface CheckoutRequest {
  cart_id: UUID;
  address_id: UUID;
  payment_method: PaymentMethod;
  delivery_slot?: { start: ISODateTime; end: ISODateTime };
  installation_slot?: { start: ISODateTime; end: ISODateTime };
  discount_code?: string;
}

export interface CheckoutResult {
  order_id: UUID;
  order_number: string;
  total: number;
  payment_url?: string;
}

export const FREE_DELIVERY_THRESHOLD_KWD = 10;
export const DEFAULT_CURRENCY = 'KWD';
