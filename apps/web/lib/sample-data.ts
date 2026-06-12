/**
 * Sample / placeholder data.
 *
 * Used ONLY as a clearly-marked fallback when the live Supabase client/env is
 * absent (fresh checkout, no `.env`), so every page renders in dev. In
 * production with env set, the real `@elite/core` reads are used instead.
 *
 * Guard all usage behind `hasSupabaseEnv === false` (or a `null` client).
 */
import type {
  Category,
  Order,
  OrderItem,
  Product,
  ProductMedia,
  ProductVariant,
  ProductWithVariants,
  Review,
  FulfillmentTask,
  Ticket,
  TicketMessage,
} from '@elite/types';

const IMG = (q: string) =>
  `https://images.unsplash.com/${q}?auto=format&fit=crop&w=900&q=70`;

export const sampleCategories: Category[] = [
  { id: 'c-tv', parent_id: null, name_ar: 'التلفزيونات والشاشات', name_en: 'TVs & Displays', slug: 'tvs-displays', image_url: IMG('photo-1593359677879-a4bb92f829d1'), sort: 1, is_active: true },
  { id: 'c-ac', parent_id: null, name_ar: 'التكييف', name_en: 'Air Conditioning', slug: 'air-conditioning', image_url: IMG('photo-1631545806609-c2b9991b7e0a'), sort: 2, is_active: true },
  { id: 'c-app', parent_id: null, name_ar: 'الأجهزة المنزلية', name_en: 'Home Appliances', slug: 'home-appliances', image_url: IMG('photo-1556911220-bff31c812dba'), sort: 3, is_active: true },
  { id: 'c-audio', parent_id: null, name_ar: 'الصوتيات', name_en: 'Audio & Sound', slug: 'audio-sound', image_url: IMG('photo-1545454675-3531b543be5d'), sort: 4, is_active: true },
  { id: 'c-smart', parent_id: null, name_ar: 'المنزل الذكي', name_en: 'Smart Home', slug: 'smart-home', image_url: IMG('photo-1558002038-1055907df827'), sort: 5, is_active: true },
  { id: 'c-comp', parent_id: null, name_ar: 'الحواسيب', name_en: 'Computers', slug: 'computers', image_url: IMG('photo-1517336714731-489689fd1ca8'), sort: 6, is_active: true },
];

interface SampleProductSeed {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  brand: string;
  category_id: string;
  requires_installation: boolean;
  installation_fee: number;
  warranty_months: number;
  price: number;
  sale_price: number | null;
  image: string;
  rating: number;
  reviews: number;
}

const seeds: SampleProductSeed[] = [
  { id: 'p-1', slug: 'samsung-65-qled-4k', name_ar: 'تلفزيون سامسونج QLED 4K مقاس 65 بوصة', name_en: 'Samsung 65" QLED 4K Smart TV', brand: 'Samsung', category_id: 'c-tv', requires_installation: true, installation_fee: 15, warranty_months: 24, price: 289.0, sale_price: 249.0, image: IMG('photo-1593359677879-a4bb92f829d1'), rating: 4.7, reviews: 128 },
  { id: 'p-2', slug: 'lg-split-ac-18000', name_ar: 'مكيف سبليت إل جي 18000 وحدة', name_en: 'LG Split AC 18,000 BTU Inverter', brand: 'LG', category_id: 'c-ac', requires_installation: true, installation_fee: 25, warranty_months: 36, price: 199.0, sale_price: null, image: IMG('photo-1631545806609-c2b9991b7e0a'), rating: 4.5, reviews: 86 },
  { id: 'p-3', slug: 'bosch-washing-machine-9kg', name_ar: 'غسالة بوش 9 كجم', name_en: 'Bosch 9kg Front-Load Washer', brand: 'Bosch', category_id: 'c-app', requires_installation: true, installation_fee: 10, warranty_months: 24, price: 159.5, sale_price: 139.5, image: IMG('photo-1626806787461-102c1bfaaea1'), rating: 4.6, reviews: 64 },
  { id: 'p-4', slug: 'sony-soundbar-ht', name_ar: 'مكبر صوت سوني HT-A5000', name_en: 'Sony HT-A5000 Soundbar', brand: 'Sony', category_id: 'c-audio', requires_installation: false, installation_fee: 0, warranty_months: 12, price: 119.0, sale_price: null, image: IMG('photo-1545454675-3531b543be5d'), rating: 4.8, reviews: 41 },
  { id: 'p-5', slug: 'ecovacs-deebot-x2', name_ar: 'مكنسة روبوت ايكوفاكس X2', name_en: 'Ecovacs Deebot X2 Robot Vacuum', brand: 'Ecovacs', category_id: 'c-smart', requires_installation: false, installation_fee: 0, warranty_months: 12, price: 89.9, sale_price: 74.9, image: IMG('photo-1558002038-1055907df827'), rating: 4.4, reviews: 73 },
  { id: 'p-6', slug: 'macbook-air-m3', name_ar: 'لابتوب ماك بوك اير M3', name_en: 'Apple MacBook Air M3 13"', brand: 'Apple', category_id: 'c-comp', requires_installation: false, installation_fee: 0, warranty_months: 12, price: 379.0, sale_price: null, image: IMG('photo-1517336714731-489689fd1ca8'), rating: 4.9, reviews: 210 },
  { id: 'p-7', slug: 'lg-french-door-fridge', name_ar: 'ثلاجة إل جي 4 أبواب', name_en: 'LG French-Door Refrigerator', brand: 'LG', category_id: 'c-app', requires_installation: true, installation_fee: 12, warranty_months: 24, price: 419.0, sale_price: 389.0, image: IMG('photo-1571175443880-49e1d25b2bc5'), rating: 4.3, reviews: 52 },
  { id: 'p-8', slug: 'samsung-galaxy-tab-s9', name_ar: 'تابلت سامسونج جالكسي تاب S9', name_en: 'Samsung Galaxy Tab S9', brand: 'Samsung', category_id: 'c-comp', requires_installation: false, installation_fee: 0, warranty_months: 12, price: 229.0, sale_price: 209.0, image: IMG('photo-1561154464-82e9adf32764'), rating: 4.6, reviews: 97 },
];

function toProduct(s: SampleProductSeed): Product {
  return {
    id: s.id,
    category_id: s.category_id,
    name_ar: s.name_ar,
    name_en: s.name_en,
    description_ar: 'منتج أصلي بضمان نيوتك. تركيب احترافي وتوصيل سريع في الكويت.',
    description_en: 'Genuine product with Newtech warranty. Professional installation and fast Kuwait delivery.',
    brand: s.brand,
    slug: s.slug,
    requires_installation: s.requires_installation,
    installation_fee: s.installation_fee,
    warranty_months: s.warranty_months,
    is_active: true,
  };
}

export const sampleProducts: Product[] = seeds.map(toProduct);

/** Lightweight per-product display extras the catalog UI uses. */
export const sampleProductMeta: Record<
  string,
  { image: string; price: number; sale_price: number | null; rating: number; reviews: number }
> = Object.fromEntries(
  seeds.map((s) => [s.id, { image: s.image, price: s.price, sale_price: s.sale_price, rating: s.rating, reviews: s.reviews }]),
);

export function sampleVariants(productId: string): ProductVariant[] {
  const s = seeds.find((x) => x.id === productId);
  if (!s) return [];
  const base: Omit<ProductVariant, 'id' | 'attributes' | 'sku'> = {
    product_id: productId,
    price: s.price,
    sale_price: s.sale_price,
    barcode: null,
    weight_g: 5000,
    is_active: true,
  };
  return [
    { ...base, id: `${productId}-v1`, sku: `${s.brand.slice(0, 3).toUpperCase()}-001`, attributes: { color: 'Black', model: 'Standard' } },
    { ...base, id: `${productId}-v2`, sku: `${s.brand.slice(0, 3).toUpperCase()}-002`, attributes: { color: 'Silver', model: 'Standard' }, sale_price: null },
  ];
}

export function sampleMedia(productId: string): ProductMedia[] {
  const meta = sampleProductMeta[productId];
  if (!meta) return [];
  return [
    { id: `${productId}-m1`, product_id: productId, variant_id: null, url: meta.image, kind: 'image', sort: 0 },
    { id: `${productId}-m2`, product_id: productId, variant_id: null, url: meta.image.replace('w=900', 'w=901'), kind: 'image', sort: 1 },
    { id: `${productId}-m3`, product_id: productId, variant_id: null, url: meta.image.replace('w=900', 'w=902'), kind: 'image', sort: 2 },
  ];
}

export function sampleProductWithVariants(slug: string): ProductWithVariants | null {
  const product = sampleProducts.find((p) => p.slug === slug);
  if (!product) return null;
  return {
    ...product,
    variants: sampleVariants(product.id),
    media: sampleMedia(product.id),
    category: sampleCategories.find((c) => c.id === product.category_id) ?? null,
  };
}

export function sampleReviews(productId: string): Review[] {
  return [
    { id: `${productId}-r1`, product_id: productId, user_id: 'u1', order_item_id: null, rating: 5, body: 'منتج ممتاز والتركيب كان احترافي وسريع.', is_published: true },
    { id: `${productId}-r2`, product_id: productId, user_id: 'u2', order_item_id: null, rating: 4, body: 'Great value, delivery within 24h as promised.', is_published: true },
    { id: `${productId}-r3`, product_id: productId, user_id: 'u3', order_item_id: null, rating: 5, body: 'Highly recommend Newtech, smooth experience.', is_published: true },
  ];
}

// ── Orders ──────────────────────────────────────────────────
export const sampleOrders: Order[] = [
  { id: 'o-1001', order_number: 'NT-100245', user_id: 'u1', status: 'out_for_delivery', subtotal: 249.0, delivery_fee: 0, installation_fee: 15, discount_total: 0, total: 264.0, currency: 'KWD', address_id: 'a1', delivery_slot: '2026-06-10T14:00:00Z', notes: null, placed_at: '2026-06-08T10:12:00Z', created_at: '2026-06-08T10:12:00Z' },
  { id: 'o-1002', order_number: 'NT-100231', user_id: 'u1', status: 'completed', subtotal: 119.0, delivery_fee: 1.5, installation_fee: 0, discount_total: 0, total: 120.5, currency: 'KWD', address_id: 'a1', delivery_slot: '2026-05-22T16:00:00Z', notes: null, placed_at: '2026-05-21T09:00:00Z', created_at: '2026-05-21T09:00:00Z' },
  { id: 'o-1003', order_number: 'NT-100210', user_id: 'u1', status: 'installing', subtotal: 199.0, delivery_fee: 0, installation_fee: 25, discount_total: 10, total: 214.0, currency: 'KWD', address_id: 'a1', delivery_slot: '2026-06-09T11:00:00Z', notes: null, placed_at: '2026-06-07T13:30:00Z', created_at: '2026-06-07T13:30:00Z' },
];

export function sampleOrderItems(orderId: string): OrderItem[] {
  const map: Record<string, OrderItem[]> = {
    'o-1001': [{ id: 'oi-1', order_id: 'o-1001', variant_id: 'p-1-v1', name_snapshot: 'Samsung 65" QLED 4K Smart TV', sku_snapshot: 'SAM-001', unit_price: 249.0, qty: 1, line_total: 249.0, with_installation: true, warranty_expires_at: '2028-06-08T00:00:00Z' }],
    'o-1002': [{ id: 'oi-2', order_id: 'o-1002', variant_id: 'p-4-v1', name_snapshot: 'Sony HT-A5000 Soundbar', sku_snapshot: 'SON-001', unit_price: 119.0, qty: 1, line_total: 119.0, with_installation: false, warranty_expires_at: '2027-05-21T00:00:00Z' }],
    'o-1003': [{ id: 'oi-3', order_id: 'o-1003', variant_id: 'p-2-v1', name_snapshot: 'LG Split AC 18,000 BTU Inverter', sku_snapshot: 'LG-001', unit_price: 199.0, qty: 1, line_total: 199.0, with_installation: true, warranty_expires_at: '2029-06-07T00:00:00Z' }],
  };
  return map[orderId] ?? [];
}

export function sampleTasks(orderId: string): FulfillmentTask[] {
  if (orderId === 'o-1001') {
    return [{ id: 't-1', order_id: orderId, type: 'delivery', status: 'en_route', assignee_id: 'd1', area: 'Salmiya', scheduled_for: '2026-06-10', window_start: '2026-06-10T14:00:00Z', window_end: '2026-06-10T16:00:00Z', sequence: 1 }];
  }
  if (orderId === 'o-1003') {
    return [{ id: 't-3', order_id: orderId, type: 'installation', status: 'in_progress', assignee_id: 'tech1', area: 'Hawalli', scheduled_for: '2026-06-09', window_start: '2026-06-09T11:00:00Z', window_end: '2026-06-09T13:00:00Z', sequence: 1 }];
  }
  return [];
}

export const sampleTickets: Ticket[] = [
  { id: 'tk-1', order_id: 'o-1002', user_id: 'u1', kind: 'warranty', status: 'open', subject: 'Soundbar HDMI port issue', assignee_id: null, zoho_desk_id: 'ZD-5521', channel: 'in_app', external_id: null, customer_phone: null, created_at: '2026-06-05T08:00:00Z' },
  { id: 'tk-2', order_id: null, user_id: 'u1', kind: 'general', status: 'resolved', subject: 'Installation scheduling question', assignee_id: 'emp1', zoho_desk_id: 'ZD-5490', channel: 'in_app', external_id: null, customer_phone: null, created_at: '2026-05-30T12:00:00Z' },
  { id: 'tk-3', order_id: 'o-1003', user_id: null, kind: 'general', status: 'open', subject: 'WhatsApp · Ahmad', assignee_id: null, zoho_desk_id: null, channel: 'whatsapp', external_id: '96550001234', customer_phone: '96550001234', created_at: '2026-06-11T09:30:00Z' },
  { id: 'tk-4', order_id: null, user_id: null, kind: 'complaint', status: 'pending', subject: 'Chatwoot · Instagram DM', assignee_id: null, zoho_desk_id: null, channel: 'chatwoot', external_id: '4821', customer_phone: null, created_at: '2026-06-10T17:10:00Z' },
];

export const sampleTicketMessages: Record<string, TicketMessage[]> = {
  'tk-1': [
    { id: 'm-1', ticket_id: 'tk-1', sender_id: 'u1', body: 'مرحباً، منفذ HDMI في الساوندبار لا يعمل.', attachments: [], direction: 'inbound', external_id: null, created_at: '2026-06-05T08:00:00Z' },
    { id: 'm-2', ticket_id: 'tk-1', sender_id: 'emp1', body: 'أهلاً بك، سنرتب زيارة فني لفحص الجهاز.', attachments: [], direction: 'outbound', external_id: null, created_at: '2026-06-05T08:12:00Z' },
  ],
  'tk-3': [
    { id: 'm-3', ticket_id: 'tk-3', sender_id: null, body: 'متى يوصل طلبي؟', attachments: [], direction: 'inbound', external_id: 'wamid.X', created_at: '2026-06-11T09:30:00Z' },
    { id: 'm-4', ticket_id: 'tk-3', sender_id: 'emp1', body: 'طلبك خرج للتوصيل وسيصل خلال ساعة.', attachments: [], direction: 'outbound', external_id: 'wamid.Y', created_at: '2026-06-11T09:35:00Z' },
  ],
};
