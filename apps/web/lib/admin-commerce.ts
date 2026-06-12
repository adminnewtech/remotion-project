import 'server-only';
import { getServerClient } from '@/lib/supabase/server';

// ── Gift Cards ─────────────────────────────────────────────────────────────

export interface GiftCardRow {
  id: string;
  code: string;
  initialValue: number;
  balance: number;
  status: string;
  recipientPhone: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface GiftCardsData {
  live: boolean;
  cards: GiftCardRow[];
  totalActive: number;
  totalLiability: number;
}

export async function fetchGiftCards(): Promise<GiftCardsData> {
  const sb = await getServerClient();
  if (!sb) {
    return { live: false, cards: sampleCards, totalActive: 1, totalLiability: 45.000 };
  }
  const { data } = await sb
    .from('gift_cards')
    .select('id, code, initial_value, balance, status, recipient_phone, expires_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!data) {
    return {
      live: false,
      cards: sampleCards,
      totalActive: 1,
      totalLiability: 45.000,
    };
  }

  const cards = data.map((c) => ({
    id: c.id, code: c.code, initialValue: c.initial_value, balance: c.balance,
    status: c.status, recipientPhone: c.recipient_phone,
    expiresAt: c.expires_at, createdAt: c.created_at,
  }));
  const active = cards.filter((c) => c.status === 'active');
  return {
    live: true, cards,
    totalActive: active.length,
    totalLiability: active.reduce((s, c) => s + c.balance, 0),
  };
}

const sampleCards: GiftCardRow[] = [
  { id: 'g1', code: 'GC-ABCDEFGHIJKLMN', initialValue: 50, balance: 35.000,
    status: 'active', recipientPhone: '96512345678', expiresAt: '2027-06-01',
    createdAt: new Date().toISOString() },
];

// ── Product Bundles ────────────────────────────────────────────────────────

export interface BundleRow {
  id: string;
  productName: string;
  productId: string;
  bundlePrice: number | null;
  isActive: boolean;
  components: {
    id: string;
    component: 'variant' | 'service';
    label: string;
    qty: number;
    pricePart: number;
  }[];
}

export interface BundlesData {
  live: boolean;
  bundles: BundleRow[];
  products: { id: string; name: string }[];
}

export async function fetchBundles(): Promise<BundlesData> {
  const sb = await getServerClient();
  if (!sb) return { live: false, bundles: sampleBundles, products: [] };
  const [{ data: bundles }, { data: products }] = await Promise.all([
    sb.from('product_bundles')
      .select(`id, bundle_price, is_active,
               products(id, name),
               bundle_components(id, component, qty, price_part, service,
                 product_variants(sku, products(name)))`)
      .order('is_active', { ascending: false }),
    sb.from('products').select('id, name').order('name').limit(200),
  ]);

  if (!bundles) {
    return { live: false, bundles: sampleBundles, products: [] };
  }

  return {
    live: true,
    products: products ?? [],
    bundles: (bundles as unknown as BundleRaw[]).map((b) => ({
      id: b.id,
      productName: (b.products as { name: string } | null)?.name ?? '—',
      productId: (b.products as { id: string } | null)?.id ?? '',
      bundlePrice: b.bundle_price,
      isActive: b.is_active,
      components: (b.bundle_components ?? []).map((c) => ({
        id: c.id,
        component: c.component as 'variant' | 'service',
        label: c.component === 'service'
          ? (c.service === 'installation' ? 'تركيب' : 'فحص')
          : ((c.product_variants?.products as { name: string } | null)?.name ?? c.product_variants?.sku ?? '—'),
        qty: c.qty,
        pricePart: c.price_part,
      })),
    })),
  };
}

interface BundleRaw {
  id: string; bundle_price: number | null; is_active: boolean;
  products: unknown;
  bundle_components: {
    id: string; component: string; qty: number; price_part: number;
    service: string | null; product_variants: { sku: string | null; products: unknown } | null;
  }[];
}

const sampleBundles: BundleRow[] = [
  { id: 'b1', productName: 'باقة مكيف 1.5 طن شامل التركيب', productId: 'p1',
    bundlePrice: 250.000, isActive: true,
    components: [
      { id: 'c1', component: 'variant', label: 'مكيف سبليت 1.5 طن', qty: 1, pricePart: 220.000 },
      { id: 'c2', component: 'service', label: 'تركيب', qty: 1, pricePart: 30.000 },
    ] },
];

// ── Reviews Moderation ─────────────────────────────────────────────────────

export interface ReviewRow {
  id: string;
  productName: string;
  customerName: string;
  rating: number;
  body: string | null;
  status: 'pending' | 'approved' | 'rejected';
  verified: boolean;
  reply: string | null;
  createdAt: string;
}

export interface ReviewsData {
  live: boolean;
  reviews: ReviewRow[];
  pendingCount: number;
}

export async function fetchReviews(): Promise<ReviewsData> {
  const sb = await getServerClient();
  if (!sb) {
    return { live: false, reviews: sampleReviews, pendingCount: 2 };
  }
  const { data } = await sb
    .from('reviews')
    .select(`id, rating, body, status, verified, reply, created_at,
             products(name), profiles(full_name)`)
    .order('created_at', { ascending: false })
    .limit(100) as unknown as { data: ReviewRaw[] | null };

  if (!data) {
    return {
      live: false,
      reviews: sampleReviews,
      pendingCount: 2,
    };
  }

  const reviews: ReviewRow[] = data.map((r) => ({
    id: r.id,
    productName: (r.products as { name: string } | null)?.name ?? '—',
    customerName: (r.profiles as { full_name: string } | null)?.full_name ?? 'مجهول',
    rating: r.rating,
    body: r.body,
    status: r.status as 'pending' | 'approved' | 'rejected',
    verified: r.verified,
    reply: r.reply,
    createdAt: r.created_at,
  }));

  return {
    live: true,
    reviews,
    pendingCount: reviews.filter((r) => r.status === 'pending').length,
  };
}

interface ReviewRaw {
  id: string; rating: number; body: string | null; status: string; verified: boolean;
  reply: string | null; created_at: string; products: unknown; profiles: unknown;
}

const sampleReviews: ReviewRow[] = [
  { id: 'r1', productName: 'مكيف سبليت 1.5 طن', customerName: 'فهد العنزي',
    rating: 5, body: 'منتج ممتاز', status: 'pending', verified: true,
    reply: null, createdAt: new Date().toISOString() },
  { id: 'r2', productName: 'ثلاجة 500 لتر', customerName: 'نورة الشمري',
    rating: 2, body: 'الجودة متوسطة', status: 'pending', verified: true,
    reply: null, createdAt: new Date().toISOString() },
];
