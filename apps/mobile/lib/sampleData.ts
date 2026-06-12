/**
 * Sample / fallback data — ONLY used when there is no live backend
 * (`hasLiveBackend === false`). Every consumer MUST guard on `hasLiveBackend`
 * before reading from here so demo data can never leak into a configured
 * production build.
 *
 * The shapes mirror `@elite/types` so screens render identically whether the
 * data is live or sampled.
 */
import type {
  Category,
  FulfillmentTask,
  InstallationJob,
  Order,
  OrderItem,
  Product,
  ProductMedia,
  ProductVariant,
  ProductWithVariants,
  Profile,
  Ticket,
  TicketMessage,
} from '@elite/types';

const now = '2026-06-09T08:00:00.000Z';

export const SAMPLE_PROFILE: Profile = {
  id: 'sample-user',
  role: 'customer',
  full_name: 'Sample User',
  phone: '+96550000000',
  email: 'sample@newtechq8.com',
  avatar_url: null,
  locale: 'ar',
  is_active: true,
  created_at: now,
};

export const SAMPLE_CATEGORIES: Category[] = [
  { id: 'c-tv', parent_id: null, name_ar: 'تلفزيونات', name_en: 'Televisions', slug: 'tv', image_url: null, sort: 1, is_active: true },
  { id: 'c-ac', parent_id: null, name_ar: 'مكيفات', name_en: 'Air Conditioners', slug: 'ac', image_url: null, sort: 2, is_active: true },
  { id: 'c-audio', parent_id: null, name_ar: 'صوتيات', name_en: 'Audio', slug: 'audio', image_url: null, sort: 3, is_active: true },
  { id: 'c-home', parent_id: null, name_ar: 'أجهزة منزلية', name_en: 'Home Appliances', slug: 'home', image_url: null, sort: 4, is_active: true },
  { id: 'c-phone', parent_id: null, name_ar: 'هواتف', name_en: 'Phones', slug: 'phones', image_url: null, sort: 5, is_active: true },
  { id: 'c-laptop', parent_id: null, name_ar: 'حواسيب', name_en: 'Laptops', slug: 'laptops', image_url: null, sort: 6, is_active: true },
];

function product(
  id: string,
  category_id: string,
  name_en: string,
  name_ar: string,
  brand: string,
  requires_installation: boolean,
  installation_fee: number,
): Product {
  return {
    id,
    category_id,
    name_ar,
    name_en,
    description_ar: 'منتج إلكتروني عالي الجودة من نيوتك مع ضمان رسمي.',
    description_en: 'High-quality electronics from Newtech with official warranty.',
    brand,
    slug: id,
    requires_installation,
    installation_fee,
    warranty_months: 12,
    is_active: true,
  };
}

export const SAMPLE_PRODUCTS: Product[] = [
  product('p-tv-65', 'c-tv', 'Samsung 65" QLED 4K', 'سامسونج 65 بوصة QLED 4K', 'Samsung', true, 8),
  product('p-tv-55', 'c-tv', 'LG 55" OLED evo', 'إل جي 55 بوصة OLED', 'LG', true, 8),
  product('p-ac-18', 'c-ac', 'Gree 1.5 Ton Split AC', 'جري مكيف سبليت 1.5 طن', 'Gree', true, 15),
  product('p-sound', 'c-audio', 'Sonos Arc Soundbar', 'سونوس آرك ساوند بار', 'Sonos', false, 0),
  product('p-fridge', 'c-home', 'LG InstaView Fridge', 'إل جي ثلاجة انستا فيو', 'LG', true, 5),
  product('p-phone', 'c-phone', 'iPhone 16 Pro Max', 'آيفون 16 برو ماكس', 'Apple', false, 0),
  product('p-laptop', 'c-laptop', 'MacBook Pro 14"', 'ماك بوك برو 14 بوصة', 'Apple', false, 0),
  product('p-wash', 'c-home', 'Bosch Washing Machine', 'بوش غسالة', 'Bosch', true, 5),
];

const VARIANT_PRICES: Record<string, { price: number; sale?: number; attrs: Record<string, string> }[]> = {
  'p-tv-65': [{ price: 289.0, sale: 259.0, attrs: { model: '65"' } }],
  'p-tv-55': [{ price: 219.0, attrs: { model: '55"' } }],
  'p-ac-18': [{ price: 159.0, sale: 139.0, attrs: { model: '1.5 Ton' } }],
  'p-sound': [{ price: 145.0, attrs: { color: 'Black' } }, { price: 145.0, attrs: { color: 'White' } }],
  'p-fridge': [{ price: 399.0, attrs: { color: 'Stainless' } }],
  'p-phone': [
    { price: 459.0, attrs: { color: 'Titanium', model: '256GB' } },
    { price: 519.0, attrs: { color: 'Titanium', model: '512GB' } },
  ],
  'p-laptop': [{ price: 649.0, attrs: { model: 'M4 / 512GB' } }],
  'p-wash': [{ price: 129.0, sale: 109.0, attrs: { model: '8kg' } }],
};

export function sampleVariants(productId: string): ProductVariant[] {
  const specs = VARIANT_PRICES[productId] ?? [{ price: 99.0, attrs: {} }];
  return specs.map((s, i) => ({
    id: `${productId}-v${i}`,
    product_id: productId,
    sku: `${productId.toUpperCase()}-${i}`,
    attributes: s.attrs,
    price: s.price,
    sale_price: s.sale ?? null,
    barcode: null,
    weight_g: null,
    is_active: true,
  }));
}

export function sampleMedia(productId: string): ProductMedia[] {
  return [
    { id: `${productId}-m0`, product_id: productId, variant_id: null, url: `https://picsum.photos/seed/${productId}/800/800`, kind: 'image', sort: 0 },
    { id: `${productId}-m1`, product_id: productId, variant_id: null, url: `https://picsum.photos/seed/${productId}b/800/800`, kind: 'image', sort: 1 },
  ];
}

export function sampleProductWithVariants(slug: string): ProductWithVariants | null {
  const p = SAMPLE_PRODUCTS.find((x) => x.slug === slug);
  if (!p) return null;
  return {
    ...p,
    variants: sampleVariants(p.id),
    media: sampleMedia(p.id),
    category: SAMPLE_CATEGORIES.find((c) => c.id === p.category_id) ?? null,
  };
}

export const SAMPLE_ORDERS: Order[] = [
  {
    id: 'o-1001', order_number: 'NT-1001', user_id: 'sample-user', status: 'out_for_delivery',
    subtotal: 259.0, delivery_fee: 0, installation_fee: 8, discount_total: 0, total: 267.0,
    currency: 'KWD', address_id: 'a-1', delivery_slot: '2026-06-09T14:00:00.000Z', notes: null,
    placed_at: '2026-06-08T10:00:00.000Z', created_at: '2026-06-08T10:00:00.000Z',
  },
  {
    id: 'o-1000', order_number: 'NT-1000', user_id: 'sample-user', status: 'completed',
    subtotal: 145.0, delivery_fee: 0, installation_fee: 0, discount_total: 0, total: 145.0,
    currency: 'KWD', address_id: 'a-1', delivery_slot: null, notes: null,
    placed_at: '2026-06-01T10:00:00.000Z', created_at: '2026-06-01T10:00:00.000Z',
  },
];

export function sampleOrderItems(orderId: string): OrderItem[] {
  if (orderId === 'o-1001') {
    return [
      { id: 'oi-1', order_id: orderId, variant_id: 'p-tv-65-v0', name_snapshot: 'Samsung 65" QLED 4K', sku_snapshot: 'P-TV-65-0', unit_price: 259.0, qty: 1, line_total: 259.0, with_installation: true, warranty_expires_at: '2027-06-08T00:00:00.000Z' },
    ];
  }
  return [
    { id: 'oi-2', order_id: orderId, variant_id: 'p-sound-v0', name_snapshot: 'Sonos Arc Soundbar', sku_snapshot: 'P-SOUND-0', unit_price: 145.0, qty: 1, line_total: 145.0, with_installation: false, warranty_expires_at: '2027-06-01T00:00:00.000Z' },
  ];
}

export function sampleTasksForOrder(orderId: string): FulfillmentTask[] {
  if (orderId === 'o-1001') {
    return [
      { id: 't-d1', order_id: orderId, type: 'delivery', status: 'en_route', assignee_id: 'driver-1', area: 'Salmiya', scheduled_for: '2026-06-09', window_start: '2026-06-09T14:00:00.000Z', window_end: '2026-06-09T16:00:00.000Z', sequence: 1 },
      { id: 't-i1', order_id: orderId, type: 'installation', status: 'assigned', assignee_id: 'tech-1', area: 'Salmiya', scheduled_for: '2026-06-10', window_start: '2026-06-10T10:00:00.000Z', window_end: '2026-06-10T12:00:00.000Z', sequence: 2 },
    ];
  }
  return [];
}

/** Driver: today's delivery queue. */
export const SAMPLE_DRIVER_TASKS: FulfillmentTask[] = [
  { id: 't-d1', order_id: 'o-1001', type: 'delivery', status: 'accepted', assignee_id: 'driver-1', area: 'Salmiya', scheduled_for: '2026-06-09', window_start: '2026-06-09T14:00:00.000Z', window_end: '2026-06-09T16:00:00.000Z', sequence: 1 },
  { id: 't-d2', order_id: 'o-1002', type: 'delivery', status: 'assigned', assignee_id: 'driver-1', area: 'Hawally', scheduled_for: '2026-06-09', window_start: '2026-06-09T16:00:00.000Z', window_end: '2026-06-09T18:00:00.000Z', sequence: 2 },
  { id: 't-d3', order_id: 'o-1003', type: 'delivery', status: 'assigned', assignee_id: 'driver-1', area: 'Jabriya', scheduled_for: '2026-06-09', window_start: '2026-06-09T18:00:00.000Z', window_end: '2026-06-09T20:00:00.000Z', sequence: 3 },
];

/** Technician: scheduled installation jobs. */
export const SAMPLE_TECH_TASKS: FulfillmentTask[] = [
  { id: 't-i1', order_id: 'o-1001', type: 'installation', status: 'assigned', assignee_id: 'tech-1', area: 'Salmiya', scheduled_for: '2026-06-10', window_start: '2026-06-10T10:00:00.000Z', window_end: '2026-06-10T12:00:00.000Z', sequence: 1 },
  { id: 't-i2', order_id: 'o-1004', type: 'installation', status: 'accepted', assignee_id: 'tech-1', area: 'Mishref', scheduled_for: '2026-06-10', window_start: '2026-06-10T13:00:00.000Z', window_end: '2026-06-10T15:00:00.000Z', sequence: 2 },
];

export const SAMPLE_CHECKLIST: InstallationJob['checklist'] = [
  { label_ar: 'فحص المكان والتأكد من القياسات', label_en: 'Inspect site and confirm measurements', done: false },
  { label_ar: 'تركيب الحامل / الوحدة', label_en: 'Mount bracket / unit', done: false },
  { label_ar: 'توصيل الكهرباء والشبكة', label_en: 'Connect power and network', done: false },
  { label_ar: 'اختبار التشغيل', label_en: 'Power-on test', done: false },
  { label_ar: 'تنظيف المكان وتسليم العميل', label_en: 'Clean up and hand over to customer', done: false },
];

/** Kuwait City center — used to seed the demo map when no live GPS. */
export const KUWAIT_CENTER = { latitude: 29.3759, longitude: 47.9774 };

export const SAMPLE_TICKETS: Ticket[] = [
  { id: 'tk-1', order_id: 'o-1000', user_id: 'sample-user', kind: 'warranty', status: 'open', subject: 'Soundbar warranty question', assignee_id: null, zoho_desk_id: null, channel: 'in_app', external_id: null, customer_phone: null, created_at: '2026-06-05T09:00:00.000Z' },
];

export function sampleTicketMessages(ticketId: string): TicketMessage[] {
  return [
    { id: `${ticketId}-m1`, ticket_id: ticketId, sender_id: 'sample-user', body: 'Hi, my soundbar keeps disconnecting.', attachments: [], direction: 'inbound', external_id: null, created_at: '2026-06-05T09:00:00.000Z' },
    { id: `${ticketId}-m2`, ticket_id: ticketId, sender_id: 'agent', body: 'Thanks for reaching out — could you share the model and purchase date?', attachments: [], direction: 'outbound', external_id: null, created_at: '2026-06-05T09:05:00.000Z' },
  ];
}
